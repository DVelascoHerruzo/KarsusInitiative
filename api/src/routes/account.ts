import { hashPassword, verifyPassword } from '../auth/password'
import { SESSION_COOKIE, expiredCookie, expiredLegacyCookie, publicUser, requireUser, sessionCookie } from '../auth/session'
import * as table from '../domain/tables'
import { HttpError, json, noContent, readJson } from '../http'
import { rateLimit } from '../rate'
import type { Services } from '../services'
import { entryId, type UserEntry } from '../store/types'
import { newPassword } from './auth'
import { deleteTable, writeTable, type Route } from './route'

// Looking after your own account: a new password, signing out other devices,
// a copy of everything stored about you, and deleting it all (GDPR articles 15,
// 17 and 20).

/** Re-asks for the password before anything drastic. Google-only accounts confirm with their email instead. */
async function confirmIdentity(user: UserEntry, body: Record<string, unknown>): Promise<void> {
  if (user.password_hash) {
    const password = typeof body.password === 'string' ? body.password : ''
    if (!(await verifyPassword(password, user.password_hash))) throw new HttpError(403, 'That password isn’t right')
  } else if (typeof body.email !== 'string' || body.email.trim().toLowerCase() !== user.email) {
    throw new HttpError(403, 'Type your account’s email to confirm')
  }
}

/** Everything stored about one account, for "Download my data". */
async function exportAccount(s: Services, user: UserEntry) {
  const [encounters, campaigns, joinedEncounters, joinedCampaigns, folders] = await Promise.all([
    s.store.listTables(user.user_id, 'encounter'),
    s.store.listTables(user.user_id, 'preset'),
    s.store.listJoinedTables(user.user_id, 'encounter'),
    s.store.listJoinedTables(user.user_id, 'preset'),
    s.store.getEntry(entryId.folders(user.user_id), 'folders'),
  ])
  const joined = [...joinedEncounters, ...joinedCampaigns].map((d) => table.upgrade(d))
  return {
    exported_at: s.now().toISOString(),
    account: {
      email: user.email,
      username: user.username,
      created_at: user.created_at,
      signs_in_with: [user.password_hash && 'password', user.google_sub && 'google'].filter(Boolean),
      email_verified: user.email_verified,
      mode: user.mode ?? 'dm',
    },
    your_encounters: encounters.map((d) => table.toEncounter(table.upgrade(d))),
    your_campaigns: campaigns.map((d) => table.toPreset(table.upgrade(d))),
    // In other people's tables, only what's yours: your role and the characters you play.
    joined: joined.map((d) => ({
      kind: d.kind === 'preset' ? 'campaign' : 'encounter',
      name: d.kind === 'preset' ? d.name : d.title,
      role: d.members.find((m) => m.user_id === user.user_id)?.role ?? null,
      characters: d.creatures.filter((c) => c.player_id === user.user_id).map(table.ownCharacter),
    })),
    folders: folders ? { folders: folders.folders, filed: folders.filed } : { folders: [], filed: {} },
  }
}

/** Removes the account and everything it owns. Characters it played in other campaigns are freed for others. */
async function deleteAccount(s: Services, user: UserEntry): Promise<void> {
  const [encounters, campaigns, joinedEncounters, joinedCampaigns] = await Promise.all([
    s.store.listTables(user.user_id, 'encounter'),
    s.store.listTables(user.user_id, 'preset'),
    s.store.listJoinedTables(user.user_id, 'encounter'),
    s.store.listJoinedTables(user.user_id, 'preset'),
  ])
  for (const doc of [...encounters, ...campaigns]) await deleteTable(s, table.upgrade(doc))
  for (const doc of [...joinedEncounters, ...joinedCampaigns]) {
    await writeTable(s, doc.owner_id, doc.kind, doc.id, (d) => table.removeMember(d, user.user_id))
  }
  await s.images?.removeAll(`${user.user_id}/`)
  await s.store.deleteEntry(entryId.folders(user.user_id))
  await s.store.deleteEntry(entryId.email(user.email))
  if (user.google_sub) await s.store.deleteEntry(entryId.google(user.google_sub))
  // Last, so a failure part-way leaves an account that can still sign in and try again.
  await s.store.deleteEntry(user.id)
}

export const accountRoutes: Route[] = [
  {
    name: 'account-password',
    route: 'auth/password',
    methods: {
      /** Sets a new password. Signs out every other device, and adds a password to a Google-only account. */
      async POST(req, s) {
        const user = await requireUser(s, req)
        await rateLimit(s, 'password', user.user_id)
        const body = await readJson(req)
        if (user.password_hash) await confirmIdentity(user, { password: body.current })
        const updated: UserEntry = {
          ...user,
          password_hash: await hashPassword(await newPassword(s, body.password)),
          session_version: user.session_version + 1,
          failed_logins: 0,
          locked_until: null,
        }
        await s.store.putEntry(updated)
        return json({ user: publicUser(updated) }, 200, { cookies: [await sessionCookie(s, updated)] })
      },
    },
  },
  {
    name: 'account-signout-others',
    route: 'auth/signout-others',
    methods: {
      /** Ends every session except this one: for a lost phone or a shared computer. */
      async POST(req, s) {
        const user = await requireUser(s, req)
        const updated: UserEntry = { ...user, session_version: user.session_version + 1 }
        await s.store.putEntry(updated)
        return noContent({ cookies: [await sessionCookie(s, updated)] })
      },
    },
  },
  {
    name: 'account-export',
    route: 'auth/export',
    methods: {
      async GET(req, s) {
        const user = await requireUser(s, req)
        await rateLimit(s, 'account', user.user_id)
        return json(await exportAccount(s, user), 200, { headers: { 'content-disposition': 'attachment; filename="karsus-data.json"' } })
      },
    },
  },
  {
    name: 'account-delete',
    route: 'auth/account',
    methods: {
      /** Deletes the account for good, after re-confirming who's asking. */
      async DELETE(req, s) {
        const user = await requireUser(s, req)
        await rateLimit(s, 'account', user.user_id)
        await confirmIdentity(user, await readJson(req))
        await deleteAccount(s, user)
        return noContent({ cookies: [expiredLegacyCookie(s, SESSION_COOKIE), expiredCookie(s, SESSION_COOKIE)] })
      },
    },
  },
]
