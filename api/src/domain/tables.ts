import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { advanceTurn, healthBand, sortByInitiative } from '@/lib/combat'
import type {
  Creature,
  CreaturePatch,
  Encounter,
  EncounterPatch,
  EncounterSummary,
  NewCreature,
  NewEncounter,
  Preset,
  PresetFields,
  PresetSummary,
  SharedEncounter,
} from '@/lib/types'
import { HttpError } from '../http'
import type { EncounterDoc, PresetDoc, TableDoc } from '../store/types'
import { MAX_CREATURES } from './validate'

// Pure operations on encounter and preset documents. The routes read a document,
// run one of these, and write it back with an ETag check.

export function createEncounter(ownerId: string, input: NewEncounter, now: Date): EncounterDoc {
  const at = now.toISOString()
  return {
    kind: 'encounter',
    id: randomUUID(),
    owner_id: ownerId,
    ...input,
    round: 1,
    active_creature_id: null,
    share_token: randomBytes(16).toString('hex'),
    share_enabled: false,
    created_at: at,
    updated_at: at,
    creatures: [],
  }
}

export function createPreset(ownerId: string, input: PresetFields, now: Date): PresetDoc {
  const at = now.toISOString()
  return { kind: 'preset', id: randomUUID(), owner_id: ownerId, ...input, created_at: at, updated_at: at, creatures: [] }
}

/** New creatures get ids and defaults; created_at steps by a millisecond so ties keep the order they were added in. */
export function addCreatures<T extends TableDoc>(doc: T, input: readonly NewCreature[], now: Date): { doc: T; added: Creature[] } {
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
      created_at: new Date(now.getTime() + i).toISOString(),
    }),
  )
  return { doc: { ...doc, creatures: [...doc.creatures, ...added] }, added }
}

export function updateCreature<T extends TableDoc>(doc: T, creatureId: string, patch: CreaturePatch): T {
  if (!doc.creatures.some((c) => c.id === creatureId)) throw new HttpError(404, 'That creature isn’t in this lineup')
  return { ...doc, creatures: doc.creatures.map((c) => (c.id === creatureId ? { ...c, ...patch } : c)) }
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

/** A fresh encounter from a preset: monsters roll d20 + bonus, players keep their initiative, everyone is at full HP. */
export function launchPreset(preset: PresetDoc, now: Date, roll: () => number = d20): EncounterDoc {
  const encounter = createEncounter(
    preset.owner_id,
    { title: preset.name, description: preset.description, background_url: preset.background_url },
    now,
  )
  encounter.creatures = preset.creatures.map((c) => ({
    ...c,
    id: randomUUID(),
    encounter_id: encounter.id,
    preset_id: null,
    initiative: c.is_player ? c.initiative : roll() + c.initiative_bonus,
    current_hp: c.max_hp,
    temp_hp: 0,
    conditions: [],
  }))
  return encounter
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
  const { id, title, description, background_url, round, active_creature_id, updated_at } = d
  return { id, title, description, background_url, round, active_creature_id, updated_at, creatures: summarizeCreatures(d.creatures) }
}

export function presetSummary(d: PresetDoc): PresetSummary {
  const { id, name, description, background_url, updated_at } = d
  return { id, name, description, background_url, updated_at, creatures: summarizeCreatures(d.creatures) }
}

/** The player view: no DM notes, and monsters show a health band instead of exact HP or AC. */
export function redact(doc: EncounterDoc): SharedEncounter {
  return {
    title: doc.title,
    description: doc.description,
    background_url: doc.background_url,
    round: doc.round,
    active_creature_id: doc.active_creature_id,
    updated_at: doc.updated_at,
    creatures: sortByInitiative(doc.creatures).map((c) => ({
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
