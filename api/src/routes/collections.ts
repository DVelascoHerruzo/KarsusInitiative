import type { CampaignSummary, CampaignView, PlayerHome, Role } from '@/lib/types'
import * as table from '../domain/tables'
import type { Services } from '../services'
import { entryId, type EncounterDoc, type PresetDoc, type TableDoc } from '../store/types'

// The lists behind each side of the table: what a DM runs, and what a player has joined.

const byUpdated = (a: { updated_at: string }, b: { updated_at: string }) => b.updated_at.localeCompare(a.updated_at)

function unique<T extends { id: string }>(docs: readonly T[]): T[] {
  return [...new Map(docs.map((d) => [d.id, d])).values()]
}

const roleOf = (doc: TableDoc, userId: string): Role | null => doc.members.find((m) => m.user_id === userId)?.role ?? null

async function joined<K extends 'encounter' | 'preset'>(s: Services, userId: string, kind: K, role: Role) {
  const docs = (await s.store.listJoinedTables(userId, kind)).map(table.upgrade)
  return docs.filter((d) => roleOf(d, userId) === role)
}

/** Encounters launched from these campaigns, one query per campaign owner. */
async function campaignEncounters(s: Services, campaigns: readonly PresetDoc[]): Promise<EncounterDoc[]> {
  const byOwner = new Map<string, string[]>()
  for (const c of campaigns) byOwner.set(c.owner_id, [...(byOwner.get(c.owner_id) ?? []), c.id])
  const lists = await Promise.all([...byOwner].map(([owner, ids]) => s.store.listCampaignEncounters(owner, ids)))
  return lists.flat().map(table.upgrade)
}

export async function dmPresets(s: Services, userId: string): Promise<PresetDoc[]> {
  const own = (await s.store.listTables(userId, 'preset')).map(table.upgrade)
  return unique([...own, ...(await joined(s, userId, 'preset', 'dm'))]).sort(byUpdated)
}

export async function dmEncounters(s: Services, userId: string): Promise<EncounterDoc[]> {
  const own = (await s.store.listTables(userId, 'encounter')).map(table.upgrade)
  const direct = await joined(s, userId, 'encounter', 'dm')
  const viaCampaign = await campaignEncounters(s, await joined(s, userId, 'preset', 'dm'))
  return unique([...own, ...direct, ...viaCampaign]).sort(byUpdated)
}

/** Usernames for a set of accounts, for "run by" and "played by" labels. */
export async function usernames(s: Services, ids: Iterable<string>): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  const users = await Promise.all(unique.map((id) => s.store.getEntry(entryId.user(id), 'user')))
  return new Map(users.flatMap((u) => (u ? [[u.user_id, u.username] as const] : [])))
}

const visibleEncounters = (docs: readonly EncounterDoc[]) => docs.filter((e) => !e.hidden)

/** Everything on a player's side of the table: their campaigns and the fights open to them. */
export async function playerHome(s: Services, userId: string): Promise<PlayerHome> {
  const campaigns = (await joined(s, userId, 'preset', 'player')).filter((c) => !c.hidden)
  const direct = visibleEncounters(await joined(s, userId, 'encounter', 'player'))
  const viaCampaign = visibleEncounters(await campaignEncounters(s, campaigns))
  const names = await usernames(s, campaigns.map((c) => c.owner_id))
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]))

  const summaries = campaigns.sort(byUpdated).map((c): CampaignSummary => {
    const party = c.creatures.filter((x) => x.is_player && !x.hidden)
    const mine = party.find((x) => x.player_id === userId)
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      background_url: c.background_url,
      dm_name: names.get(c.owner_id) ?? 'Your DM',
      character: mine ? { id: mine.id, name: mine.name, image_url: mine.image_url, is_player: true } : null,
      party: party.map(({ id, name, image_url }) => ({ id, name, image_url, is_player: true })),
      updated_at: c.updated_at,
    }
  })

  return {
    campaigns: summaries,
    encounters: unique([...direct, ...viaCampaign])
      .sort(byUpdated)
      .map((e) => table.playerEncounterSummary(e, userId, e.campaign_id ? (campaignName.get(e.campaign_id) ?? null) : null)),
  }
}

/** A campaign from one player's seat: the party, their own character in full, and the fights it has open. */
export async function campaignView(s: Services, campaign: PresetDoc, userId: string): Promise<CampaignView> {
  const party = campaign.creatures.filter((c) => c.is_player && !c.hidden)
  const names = await usernames(s, [campaign.owner_id, ...party.flatMap((c) => (c.player_id ? [c.player_id] : []))])
  const mine = party.find((c) => c.player_id === userId)
  const encounters = visibleEncounters(await campaignEncounters(s, [campaign])).sort(byUpdated)
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    background_url: campaign.background_url,
    dm_name: names.get(campaign.owner_id) ?? 'Your DM',
    party: party.map((c) => table.partyMember(c, names)),
    mine: mine ? table.ownCharacter(mine) : null,
    available: table.availableCharacters(campaign).map((c) => table.partyMember(c, names)),
    encounters: encounters.map((e) => table.playerEncounterSummary(e, userId, campaign.name)),
  }
}
