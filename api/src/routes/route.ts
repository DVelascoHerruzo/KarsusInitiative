import { syncCharacters, upgrade } from '../domain/tables'
import { HttpError, type ApiRequest, type ApiResponse } from '../http'
import type { Services } from '../services'
import { entryId, type DocOf, type Kind, type PresetDoc, type TableDoc } from '../store/types'

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'
export type Handler = (req: ApiRequest, s: Services) => Promise<ApiResponse>

/** One Azure Function per route template; the method picks the handler. */
export interface Route {
  name: string
  /** Relative to /api, in Azure Functions template syntax: `encounters/{id}`. */
  route: string
  methods: Partial<Record<Method, Handler>>
}

export function param(req: ApiRequest, name: string): string {
  const value = req.params[name]
  if (!value) throw new HttpError(400, `Missing ${name}`)
  return value
}

// ─── Who can open a table ────────────────────────────────────────────────────
// The owner can do anything. A co-DM (role "dm") can do everything except delete
// the table. A player sees the player side, and only while the DM hasn't hidden
// it. Encounters launched from a campaign are open to that campaign's members
// with the same roles.

export type Access = 'player' | 'dm' | 'owner'
const RANK: Record<Access, number> = { player: 0, dm: 1, owner: 2 }

const NOT_FOUND = { encounter: 'Encounter not found', preset: 'Preset not found' } satisfies Record<Kind, string>

export interface Opened<K extends Kind> {
  doc: DocOf<K>
  access: Access
  /** For an encounter launched from a campaign, that campaign. */
  campaign: PresetDoc | null
}

/** Tables are partitioned by owner. The locator says which; tables made before locators exist only for their owner, who gets one written now. */
async function ownerOf(s: Services, userId: string, kind: Kind, id: string): Promise<string | null> {
  const located = await s.store.getEntry(entryId.table(id), 'table')
  if (located) return located.table_kind === kind ? located.owner_id : null
  if (!(await s.store.getTable(userId, kind, id))) return null
  await s.store.putEntry({ id: entryId.table(id), kind: 'table', owner_id: userId, table_kind: kind })
  return userId
}

export async function getCampaign(s: Services, doc: TableDoc): Promise<PresetDoc | null> {
  if (doc.kind !== 'encounter' || !doc.campaign_id) return null
  const found = await s.store.getTable(doc.owner_id, 'preset', doc.campaign_id)
  return found ? upgrade(found.doc) : null
}

/** The caller's standing at a table, or null when it's closed to them. */
export function accessTo(userId: string, doc: TableDoc, campaign: PresetDoc | null): Access | null {
  if (doc.owner_id === userId) return 'owner'
  const direct = doc.members.find((m) => m.user_id === userId)?.role
  const viaCampaign = campaign?.members.find((m) => m.user_id === userId)?.role
  if (direct === 'dm' || viaCampaign === 'dm') return 'dm'
  const hidden = doc.hidden || (campaign?.hidden ?? false)
  if ((direct === 'player' || viaCampaign === 'player') && !hidden) return 'player'
  return null
}

function check(access: Access | null, need: Access, kind: Kind) {
  // A closed table looks exactly like a missing one.
  if (access === null) throw new HttpError(404, NOT_FOUND[kind])
  if (RANK[access] < RANK[need]) throw new HttpError(403, need === 'owner' ? 'Only the owner can do that' : 'Only the DM can do that')
}

/** Reads a table the caller may open with at least `need` access. */
export async function openTable<K extends Kind>(s: Services, userId: string, kind: K, id: string, need: Access): Promise<Opened<K>> {
  const ownerId = await ownerOf(s, userId, kind, id)
  const found = ownerId ? await s.store.getTable(ownerId, kind, id) : null
  if (!found) throw new HttpError(404, NOT_FOUND[kind])
  const doc = upgrade(found.doc)
  const campaign = await getCampaign(s, doc)
  const access = accessTo(userId, doc, campaign)
  check(access, need, kind)
  return { doc, access: access!, campaign }
}

/**
 * Read, change, write back only if nobody else wrote in between; otherwise
 * re-read and apply the change again. Two devices editing different creatures
 * both land. No access check: callers use mutateTable, or have checked already.
 */
export async function writeTable<K extends Kind>(
  s: Services,
  ownerId: string,
  kind: K,
  id: string,
  apply: (doc: DocOf<K>) => DocOf<K> | Promise<DocOf<K>>,
): Promise<DocOf<K>> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const found = await s.store.getTable(ownerId, kind, id)
    if (!found) throw new HttpError(404, NOT_FOUND[kind])
    const current = upgrade(found.doc)
    const changed = await apply(current)
    if (changed === current) return current
    const doc = { ...changed, updated_at: s.now().toISOString() }
    if (await s.store.replaceTable(doc, found.etag)) {
      const saved: TableDoc = doc
      if (saved.kind === 'encounter') await s.live.notify(saved.share_token)
      return doc
    }
  }
  throw new HttpError(409, 'Too many edits at once. Try again.')
}

/** Changes a table the caller may open with at least `need` access; `apply` sees their access too. */
export async function mutateTable<K extends Kind>(
  s: Services,
  userId: string,
  kind: K,
  id: string,
  need: Access,
  apply: (doc: DocOf<K>, access: Access) => DocOf<K>,
): Promise<DocOf<K>> {
  const { doc: first } = await openTable(s, userId, kind, id, need)
  return writeTable(s, first.owner_id, kind, id, async (doc) => {
    const access = accessTo(userId, doc, await getCampaign(s, doc))
    check(access, need, kind)
    return apply(doc, access!)
  })
}

/** Pushes a campaign's character changes into every encounter launched from it. */
export async function syncCampaign(s: Services, campaign: PresetDoc): Promise<void> {
  const encounters = await s.store.listCampaignEncounters(campaign.owner_id, [campaign.id])
  for (const found of encounters) {
    const e = upgrade(found)
    if (syncCharacters(e, campaign) === e) continue
    await writeTable(s, e.owner_id, 'encounter', e.id, (doc) => syncCharacters(doc, campaign))
  }
}

// ─── Creating and deleting ───────────────────────────────────────────────────

/** Writes a new table with its locator (and, for an encounter, its share link, switched off). */
export async function createTable(s: Services, doc: TableDoc): Promise<void> {
  await s.store.putEntry({ id: entryId.table(doc.id), kind: 'table', owner_id: doc.owner_id, table_kind: doc.kind })
  if (doc.kind === 'encounter') {
    await s.store.createEntry({ id: entryId.share(doc.share_token), kind: 'share', owner_id: doc.owner_id, encounter_id: doc.id })
  }
  await s.store.createTable(doc)
}

export async function deleteTable(s: Services, doc: TableDoc): Promise<void> {
  if (doc.kind === 'encounter') {
    await s.store.deleteEntry(entryId.share(doc.share_token))
    await s.store.deleteEntry(entryId.presence(doc.id))
  }
  for (const token of [doc.invites.player, doc.invites.dm]) if (token) await s.store.deleteEntry(entryId.invite(token))
  await s.store.deleteTable(doc.owner_id, doc.id)
  await s.store.deleteEntry(entryId.table(doc.id))
}
