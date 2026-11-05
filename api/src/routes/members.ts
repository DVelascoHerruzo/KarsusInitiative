import type { InvitePreview, Invites } from '@/lib/types'
import { currentUser, requireUser } from '../auth/session'
import * as table from '../domain/tables'
import * as v from '../domain/validate'
import { HttpError, json, noContent, readJson } from '../http'
import { rateLimit } from '../rate'
import type { Services } from '../services'
import { entryId, type InviteEntry, type Kind, type TableDoc } from '../store/types'
import { usernames } from './collections'
import { mutateTable, param, syncCampaign, writeTable, type Route } from './route'
import { applyChoice } from './presets'

// Invite links and the people they let in. A DM makes one link per role and
// sends it however they like; opening it while signed in joins the table.
// Resetting a link makes the old one stop working; members stay until removed.

const INVITE_GONE = 'This invite link doesn’t work anymore. Ask your DM for a new one.'

async function afterWrite(s: Services, doc: TableDoc) {
  // Members coming and going changes who plays which campaign character.
  if (doc.kind === 'preset') await syncCampaign(s, doc)
}

function routesFor(prefix: 'encounters' | 'presets', kind: Kind): Route[] {
  return [
    {
      name: `${kind}-invite`,
      route: `${prefix}/{id}/invites/{role}`,
      methods: {
        /** Makes the link for a role, or replaces it so the old one stops working. */
        async POST(req, s) {
          const user = await requireUser(s, req)
          const role = v.role(param(req, 'role'))
          const token = table.newToken()
          const doc = await mutateTable(s, user.user_id, kind, param(req, 'id'), 'dm', (d) => ({ ...d, invites: { ...d.invites, [role]: token } }))
          const entry: InviteEntry = { id: entryId.invite(token), kind: 'invite', owner_id: doc.owner_id, table_id: doc.id, table_kind: kind, role }
          await s.store.putEntry(entry)
          return json(doc.invites satisfies Invites)
        },
        /** Switches the link off. */
        async DELETE(req, s) {
          const user = await requireUser(s, req)
          const role = v.role(param(req, 'role'))
          let old: string | null = null
          const doc = await mutateTable(s, user.user_id, kind, param(req, 'id'), 'dm', (d) => {
            old = d.invites[role]
            return { ...d, invites: { ...d.invites, [role]: null } }
          })
          if (old) await s.store.deleteEntry(entryId.invite(old))
          return json(doc.invites)
        },
      },
    },
    {
      name: `${kind}-member`,
      route: `${prefix}/{id}/members/{uid}`,
      methods: {
        async PATCH(req, s) {
          const user = await requireUser(s, req)
          const role = v.role((await readJson(req)).role)
          const uid = param(req, 'uid')
          const doc = await mutateTable(s, user.user_id, kind, param(req, 'id'), 'dm', (d) => table.setMemberRole(d, uid, role))
          return json(doc.members)
        },
        /** The DM removes someone, or a member leaves. Either way their characters are freed. */
        async DELETE(req, s) {
          const user = await requireUser(s, req)
          const uid = param(req, 'uid')
          const id = param(req, 'id')
          let doc: TableDoc
          if (uid === user.user_id) {
            // Leaving works even after the DM hid the table, so it can't go through the access check.
            const located = await s.store.getEntry(entryId.table(id), 'table')
            if (!located || located.table_kind !== kind) return noContent()
            doc = await writeTable(s, located.owner_id, kind, id, (d) => (d.members.some((m) => m.user_id === uid) ? table.removeMember(d, uid) : d))
          } else {
            doc = await mutateTable(s, user.user_id, kind, id, 'dm', (d) => table.removeMember(d, uid))
          }
          await afterWrite(s, doc)
          return noContent()
        },
      },
    },
  ]
}

const standing = (doc: TableDoc, userId: string) =>
  doc.owner_id === userId ? ('owner' as const) : (doc.members.find((m) => m.user_id === userId)?.role ?? null)

async function inviteFor(s: Services, token: string) {
  const entry = /^[0-9a-f]{32}$/.test(token) ? await s.store.getEntry(entryId.invite(token), 'invite') : null
  const found = entry && (await s.store.getTable(entry.owner_id, entry.table_kind, entry.table_id))
  const doc = found && table.upgrade(found.doc)
  // A reset link leaves its old entry behind only briefly; the document is the source of truth.
  if (!entry || !doc || doc.invites[entry.role] !== token) throw new HttpError(404, INVITE_GONE)
  return { entry, doc }
}

export const memberRoutes: Route[] = [
  ...routesFor('encounters', 'encounter'),
  ...routesFor('presets', 'preset'),
  {
    name: 'invite',
    route: 'invites/{token}',
    methods: {
      /** What the link leads to, so the person can see what they're joining and pick a character first. */
      async GET(req, s) {
        const { entry, doc } = await inviteFor(s, param(req, 'token'))
        const user = await currentUser(s, req)
        const characters = table.availableCharacters(doc)
        const names = await usernames(s, [doc.owner_id])
        const preview: InvitePreview = {
          kind: doc.kind === 'preset' ? 'campaign' : 'encounter',
          id: doc.id,
          name: doc.kind === 'preset' ? doc.name : doc.title,
          description: doc.description,
          background_url: doc.background_url,
          role: entry.role,
          dm_name: names.get(doc.owner_id) ?? 'Your DM',
          characters: characters.map((c) => table.partyMember(c, names)),
          current: user ? standing(doc, user.user_id) : null,
        }
        return json(preview)
      },
      /** Joins the table. A player can pick their character in the same step. */
      async POST(req, s) {
        const user = await requireUser(s, req)
        await rateLimit(s, 'invite', user.user_id)
        const { entry } = await inviteFor(s, param(req, 'token'))
        const body = await readJson(req)
        const choice = body.claim !== undefined || body.create !== undefined ? v.characterChoice(body) : null
        const kind = entry.table_kind === 'preset' ? 'campaign' : 'encounter'
        if (entry.owner_id === user.user_id) return json({ kind, id: entry.table_id, role: 'owner' })

        const doc = await writeTable(s, entry.owner_id, entry.table_kind, entry.table_id, (d) => {
          if (d.invites[entry.role] !== param(req, 'token')) throw new HttpError(404, INVITE_GONE)
          const joined = table.addMember(d, { user_id: user.user_id, username: user.username, role: entry.role, joined_at: s.now().toISOString() })
          const role = joined.members.find((m) => m.user_id === user.user_id)!.role
          return choice && role === 'player' ? applyChoice(joined, user.user_id, choice, s.now()) : joined
        })
        await afterWrite(s, doc)
        return json({ kind, id: doc.id, role: doc.members.find((m) => m.user_id === user.user_id)!.role }, 201)
      },
    },
  },
]
