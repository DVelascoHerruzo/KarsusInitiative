import { randomUUID } from 'node:crypto'
import type { Cookie } from '@azure/functions'
import type { GuestSession } from '@/lib/types'
import { GUEST_COOKIE, GUEST_DAYS, currentGuest, currentUser, expiredCookie, guestCookie, type Guest } from '../auth/session'
import * as table from '../domain/tables'
import { HttpError, json, noContent, type ApiRequest } from '../http'
import { clientIp, rateLimit } from '../rate'
import type { Services } from '../services'
import { entryId, type EncounterDoc } from '../store/types'
import { createTable, deleteTable, type Route } from './route'

// Running an encounter without an account. The board works before anything is
// saved; the first change calls POST /guest, which creates the encounter and the
// cookie that owns it. Both end after GUEST_DAYS, unless the guest signs up or
// signs in, which moves the encounter (share link and all) into the account.

export const publicGuest = (g: Guest): GuestSession => ({ encounter_id: g.encounter_id, expires_at: g.expires_at })

/** The guest's encounter, if it's still there. */
async function guestEncounter(s: Services, guest: Guest): Promise<EncounterDoc | null> {
  const found = await s.store.getTable(guest.guest_id, 'encounter', guest.encounter_id)
  return found && !table.isExpired(found.doc, s.now()) ? table.upgrade(found.doc) : null
}

/**
 * At sign-up or sign-in: moves this browser's guest encounter into the account,
 * keeping its id and share link, so a player view already on the TV carries on.
 * The copy is written before the guest's is deleted, so a failure never loses it.
 */
export async function adoptGuest(s: Services, req: ApiRequest, userId: string): Promise<{ adopted: number; cookies: Cookie[] }> {
  const guest = await currentGuest(s, req)
  if (!guest) return { adopted: 0, cookies: [] }
  let adopted = 0
  for (const found of await s.store.listTables(guest.guest_id, 'encounter')) {
    const doc = table.upgrade(found)
    if (table.isExpired(doc, s.now())) continue
    const { expires_at: _expires, ttl: _ttl, ...kept } = doc
    const moved: EncounterDoc = { ...kept, owner_id: userId, creatures: kept.creatures.map((c) => ({ ...c, owner_id: userId })), updated_at: s.now().toISOString() }
    await s.store.createTable(moved)
    // Rewritten without a ttl: from now on they last as long as the account.
    await s.store.putEntry({ id: entryId.table(doc.id), kind: 'table', owner_id: userId, table_kind: 'encounter' })
    await s.store.putEntry({ id: entryId.share(doc.share_token), kind: 'share', owner_id: userId, encounter_id: doc.id })
    await s.store.deleteTable(guest.guest_id, doc.id)
    adopted++
  }
  return { adopted, cookies: [expiredCookie(s, GUEST_COOKIE)] }
}

export const guestRoutes: Route[] = [
  {
    name: 'guest',
    route: 'guest',
    methods: {
      /** This browser's guest encounter: the existing one, or a new, empty one that ends in GUEST_DAYS. */
      async POST(req, s) {
        if (await currentUser(s, req)) throw new HttpError(409, 'You’re signed in: start encounters from your dashboard.')
        const existing = await currentGuest(s, req)
        const kept = existing && (await guestEncounter(s, existing))
        if (existing && kept) return json({ guest: publicGuest(existing), encounter: table.toEncounter(kept) })

        await rateLimit(s, 'guest', clientIp(req))
        const now = s.now()
        const guestId = `guest-${randomUUID()}`
        const expires_at = new Date(now.getTime() + GUEST_DAYS * 24 * 60 * 60 * 1000).toISOString()
        const doc: EncounterDoc = { ...table.createEncounter(guestId, { title: 'New encounter', description: null, background_url: null }, now), expires_at }
        await createTable(s, doc)
        const guest: Guest = { guest_id: guestId, encounter_id: doc.id, expires_at }
        return json({ guest: publicGuest(guest), encounter: table.toEncounter(doc) }, 201, { cookies: [await guestCookie(s, guest)] })
      },
      /** Start over: deletes the guest encounter and forgets the guest. */
      async DELETE(req, s) {
        const guest = await currentGuest(s, req)
        const doc = guest && (await guestEncounter(s, guest))
        if (doc) await deleteTable(s, doc)
        return noContent({ cookies: [expiredCookie(s, GUEST_COOKIE)] })
      },
    },
  },
]
