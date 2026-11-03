import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { advanceTurn, healthBand, sortByInitiative } from '@/lib/combat'
import type {
  Creature,
  CreaturePatch,
  Encounter,
  EncounterPatch,
  EncounterSummary,
  Member,
  NewCreature,
  NewEncounter,
  PartyMember,
  PlayerEncounterSummary,
  Preset,
  PresetFields,
  PresetSummary,
  Role,
  SharedEncounter,
} from '@/lib/types'
import { HttpError } from '../http'
import type { EncounterDoc, PresetDoc, TableDoc } from '../store/types'
import { MAX_CREATURES } from './validate'

// Pure operations on encounter and preset documents. The routes read a document,
// run one of these, and write it back with an ETag check.

export const newToken = () => randomBytes(16).toString('hex')

export function createEncounter(ownerId: string, input: NewEncounter, now: Date): EncounterDoc {
  const at = now.toISOString()
  return {
    kind: 'encounter',
    id: randomUUID(),
    owner_id: ownerId,
    ...input,
    round: 1,
    active_creature_id: null,
    share_token: newToken(),
    share_enabled: false,
    campaign_id: null,
    hidden: false,
    members: [],
    invites: { player: null, dm: null },
    created_at: at,
    updated_at: at,
    creatures: [],
  }
}

export function createPreset(ownerId: string, input: PresetFields, now: Date): PresetDoc {
  const at = now.toISOString()
  return {
    kind: 'preset',
    id: randomUUID(),
    owner_id: ownerId,
    ...input,
    hidden: false,
    members: [],
    invites: { player: null, dm: null },
    created_at: at,
    updated_at: at,
    creatures: [],
  }
}

/** Fills in fields added after a document was first written, so old encounters and presets keep working. */
export function upgrade<T extends TableDoc>(doc: T): T {
  const creatures = doc.creatures.map((c) => ({
    ...c,
    hidden: c.hidden ?? false,
    player_id: c.player_id ?? null,
    character_id: c.character_id ?? null,
    sheet: c.sheet ?? null,
  }))
  const common = { ...doc, hidden: doc.hidden ?? false, members: doc.members ?? [], invites: doc.invites ?? { player: null, dm: null }, creatures }
  return (common.kind === 'encounter' ? { ...common, campaign_id: common.campaign_id ?? null } : common) as T
}

/** New creatures get ids and defaults; created_at steps by a millisecond so ties keep the order they were added in. */
export function addCreatures<T extends TableDoc>(
  doc: T,
  input: readonly NewCreature[],
  now: Date,
  playerId: string | null = null,
): { doc: T; added: Creature[] } {
  if (doc.creatures.length + input.length > MAX_CREATURES) {
    throw new HttpError(400, `A lineup can hold at most ${MAX_CREATURES} creatures`)
  }
  const added = input.map(
    (c, i): Creature => ({
      id: randomUUID(),
      owner_id: doc.owner_id,
      encounter_id: doc.kind === 'encounter' ? doc.id : null,
      preset_id: doc.kind === 'preset' ? doc.id : null,
      name: c.name,
      is_player: c.is_player ?? false,
      initiative: c.initiative ?? 10,
      initiative_bonus: c.initiative_bonus ?? 0,
      max_hp: c.max_hp ?? null,
      current_hp: c.current_hp ?? null,
      temp_hp: c.temp_hp ?? 0,
      armor_class: c.armor_class ?? null,
      conditions: c.conditions ?? [],
      notes: c.notes ?? null,
      image_url: c.image_url ?? null,
      hidden: c.hidden ?? false,
      player_id: playerId,
      character_id: null,
      sheet: c.sheet ?? null,
      created_at: new Date(now.getTime() + i).toISOString(),
    }),
  )
  return { doc: { ...doc, creatures: [...doc.creatures, ...added] }, added }
}

export function updateCreature<T extends TableDoc>(doc: T, creatureId: string, patch: CreaturePatch): T {
  if (!doc.creatures.some((c) => c.id === creatureId)) throw new HttpError(404, 'That creature isn’t in this lineup')
  return {
    ...doc,
    creatures: doc.creatures.map((c) => {
      if (c.id !== creatureId) return c
      const next = { ...c, ...patch }
      // A player who stops being a PC stops being anyone's character.
      return next.is_player ? next : { ...next, player_id: null }
    }),
  }
}

/** Removing the creature whose turn it is hands the turn to the next one first. */
export function removeCreature<T extends TableDoc>(doc: T, creatureId: string): T {
  if (!doc.creatures.some((c) => c.id === creatureId)) throw new HttpError(404, 'That creature isn’t in this lineup')
  let next: TableDoc = doc
  if (next.kind === 'encounter' && next.active_creature_id === creatureId) next = advance(next, 1)
  const creatures = next.creatures.filter((c) => c.id !== creatureId)
  if (next.kind === 'encounter') {
    return { ...next, creatures, active_creature_id: next.active_creature_id === creatureId ? null : next.active_creature_id } as T
  }
  return { ...next, creatures } as T
}

/** Runs the shared turn engine (src/lib/combat.ts), the same code the DM screen uses for its optimistic update. */
export function advance(doc: EncounterDoc, step: 1 | -1): EncounterDoc {
  const next = advanceTurn({ round: doc.round, activeId: doc.active_creature_id, creatures: doc.creatures }, step)
  return { ...doc, round: next.round, active_creature_id: next.activeId, creatures: next.creatures }
}

export function patchEncounter(doc: EncounterDoc, patch: EncounterPatch): EncounterDoc {
  const active = patch.active_creature_id
  if (active && !doc.creatures.some((c) => c.id === active)) throw new HttpError(400, 'The active creature isn’t in this encounter')
  return { ...doc, ...patch }
}

const d20 = () => randomInt(1, 21)

/**
 * A fresh encounter from a preset: monsters roll d20 + bonus, players keep their
 * initiative, everyone is at full HP. It belongs to the preset's owner whoever
 * launches it, and remembers its campaign, so the campaign's players see it and
 * each character stays tied to the player who plays it.
 */
export function launchPreset(preset: PresetDoc, now: Date, roll: () => number = d20): EncounterDoc {
  const encounter = createEncounter(
    preset.owner_id,
    { title: preset.name, description: preset.description, background_url: preset.background_url },
    now,
  )
  encounter.campaign_id = preset.id
  encounter.creatures = preset.creatures.map((c) => ({
    ...c,
    id: randomUUID(),
    encounter_id: encounter.id,
    preset_id: null,
    character_id: c.is_player ? c.id : null,
    initiative: c.is_player ? c.initiative : roll() + c.initiative_bonus,
    current_hp: c.max_hp,
    temp_hp: 0,
    conditions: [],
  }))
  return encounter
}

// ─── Members and characters ──────────────────────────────────────────────────

/** Adds a member, or promotes one. An invite never demotes anyone. */
export function addMember<T extends TableDoc>(doc: T, member: Member): T {
  const existing = doc.members.find((m) => m.user_id === member.user_id)
  if (!existing) return { ...doc, members: [...doc.members, member] }
  if (existing.role === 'dm' || member.role === existing.role) return doc
  return { ...doc, members: doc.members.map((m) => (m.user_id === member.user_id ? { ...m, role: member.role } : m)) }
}

export function setMemberRole<T extends TableDoc>(doc: T, userId: string, role: Role): T {
  if (!doc.members.some((m) => m.user_id === userId)) throw new HttpError(404, 'They aren’t a member')
  return { ...doc, members: doc.members.map((m) => (m.user_id === userId ? { ...m, role } : m)) }
}

/** Removing someone frees the characters they played, for the next player to pick. */
export function removeMember<T extends TableDoc>(doc: T, userId: string): T {
  return releaseCharacters({ ...doc, members: doc.members.filter((m) => m.user_id !== userId) }, userId)
}

export function releaseCharacters<T extends TableDoc>(doc: T, userId: string): T {
  return { ...doc, creatures: doc.creatures.map((c) => (c.player_id === userId ? { ...c, player_id: null } : c)) }
}

/** Characters a player can pick: PCs the DM hasn't hidden and nobody else plays. */
export const availableCharacters = (doc: TableDoc) => doc.creatures.filter((c) => c.is_player && !c.hidden && c.player_id === null)

/** A player plays one character per table: claiming one frees the one they had. */
export function claimCharacter<T extends TableDoc>(doc: T, userId: string, creatureId: string): T {
  const target = doc.creatures.find((c) => c.id === creatureId)
  if (!target || !target.is_player || target.hidden) throw new HttpError(404, 'That character isn’t available')
  if (target.player_id === userId) return doc
  if (target.player_id !== null) throw new HttpError(409, 'Someone else already plays that character')
  const released = releaseCharacters(doc, userId)
  return { ...released, creatures: released.creatures.map((c) => (c.id === creatureId ? { ...c, player_id: userId } : c)) }
}

/** The fields a campaign character shares with its copies in that campaign's encounters. */
const CHARACTER_FIELDS = ['name', 'image_url', 'initiative_bonus', 'max_hp', 'armor_class', 'sheet', 'player_id', 'is_player'] as const

/**
 * Copies a campaign's characters into one of its encounters: a level-up, a new
 * portrait or a change of player shows up mid-campaign. HP and conditions in the
 * fight are left alone, except that current HP can't exceed a lowered maximum.
 */
export function syncCharacters(encounter: EncounterDoc, campaign: PresetDoc): EncounterDoc {
  const byId = new Map(campaign.creatures.map((c) => [c.id, c]))
  let changed = false
  const creatures = encounter.creatures.map((c) => {
    const source = c.character_id ? byId.get(c.character_id) : undefined
    if (!source) return c
    const next: Creature = { ...c, ...Object.fromEntries(CHARACTER_FIELDS.map((key) => [key, source[key]])) }
    if (next.max_hp !== null && next.current_hp !== null) next.current_hp = Math.min(next.current_hp, next.max_hp)
    if (JSON.stringify(next) === JSON.stringify(c)) return c
    changed = true
    return next
  })
  return changed ? { ...encounter, creatures } : encounter
}

// ─── What leaves the server ──────────────────────────────────────────────────

export function toEncounter({ kind: _kind, ...encounter }: EncounterDoc): Encounter {
  return encounter
}

export function toPreset({ kind: _kind, ...preset }: PresetDoc): Preset {
  return preset
}

const summarizeCreatures = (creatures: readonly Creature[]) =>
  creatures.map(({ id, name, image_url, is_player }) => ({ id, name, image_url, is_player }))

export function encounterSummary(d: EncounterDoc): EncounterSummary {
  const { id, owner_id, title, description, background_url, round, active_creature_id, campaign_id, hidden, updated_at } = d
  return {
    id,
    owner_id,
    title,
    description,
    background_url,
    round,
    active_creature_id,
    campaign_id,
    hidden,
    updated_at,
    creatures: summarizeCreatures(d.creatures),
    members: d.members.length,
  }
}

export function presetSummary(d: PresetDoc): PresetSummary {
  const { id, owner_id, name, description, background_url, hidden, updated_at } = d
  return { id, owner_id, name, description, background_url, hidden, updated_at, creatures: summarizeCreatures(d.creatures), members: d.members.length }
}

export function playerEncounterSummary(d: EncounterDoc, userId: string, campaignName: string | null): PlayerEncounterSummary {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    background_url: d.background_url,
    round: d.round,
    started: d.active_creature_id !== null,
    campaign_name: campaignName,
    character_name: d.creatures.find((c) => c.player_id === userId && !c.hidden)?.name ?? null,
    updated_at: d.updated_at,
  }
}

/** A character as the rest of the party sees it: who plays it and the headline numbers. */
export function partyMember(c: Creature, names: ReadonlyMap<string, string>): PartyMember {
  return {
    id: c.id,
    name: c.name,
    image_url: c.image_url,
    player_name: c.player_id ? (names.get(c.player_id) ?? null) : null,
    classes: c.sheet?.classes ?? [],
    max_hp: c.max_hp,
    armor_class: c.armor_class,
  }
}

/** A player's own character: everything except the DM's notes. */
export const ownCharacter = (c: Creature): Creature => ({ ...c, notes: null })

/** The player view: no DM notes or hidden creatures, and monsters show a health band instead of exact HP or AC. */
export function redact(doc: EncounterDoc): SharedEncounter {
  const visible = doc.creatures.filter((c) => !c.hidden)
  const active = visible.some((c) => c.id === doc.active_creature_id) ? doc.active_creature_id : null
  return {
    title: doc.title,
    description: doc.description,
    background_url: doc.background_url,
    round: doc.round,
    active_creature_id: active,
    hidden_turn: doc.active_creature_id !== null && active === null,
    updated_at: doc.updated_at,
    creatures: sortByInitiative(visible).map((c) => ({
      id: c.id,
      name: c.name,
      is_player: c.is_player,
      initiative: c.initiative,
      image_url: c.image_url,
      conditions: c.conditions,
      current_hp: c.is_player ? c.current_hp : null,
      max_hp: c.is_player ? c.max_hp : null,
      temp_hp: c.is_player ? c.temp_hp : 0,
      armor_class: c.is_player ? c.armor_class : null,
      health: healthBand(c.current_hp, c.max_hp),
    })),
  }
}
