import { HttpError } from '../http'
import { ABILITY_KEYS, SKILL_KEYS } from '@/lib/sheet'
import type {
  Ability,
  CharacterChoice,
  CharacterSheet,
  Condition,
  CreaturePatch,
  EncounterPatch,
  Folders,
  Mode,
  NewCreature,
  NewEncounter,
  PresetFields,
  PresetPatch,
  Proficiency,
  Role,
  Skill,
} from '@/lib/types'

// Hand-written parsers for every body the API accepts. Only whitelisted fields
// pass; anything malformed is a 400 with a sentence the UI can show.

type Body = Record<string, unknown>

const bad = (message: string): never => {
  throw new HttpError(400, message)
}

function text(v: unknown, field: string, max: number, min = 0): string {
  if (typeof v !== 'string') return bad(`${field} must be text`)
  const s = v.trim()
  if (s.length < min) return bad(min === 1 ? `${field} can’t be empty` : `${field} is too short`)
  if (s.length > max) return bad(`${field} must be at most ${max} characters`)
  return s
}

const optionalText = (v: unknown, field: string, max: number): string | null =>
  v === null || v === undefined || v === '' ? null : text(v, field, max)

function int(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) return bad(`${field} must be a whole number`)
  if (v < min || v > max) return bad(`${field} must be between ${min} and ${max}`)
  return v
}

const optionalInt = (v: unknown, field: string, min: number, max: number): number | null =>
  v === null ? null : int(v, field, min, max)

function bool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') return bad(`${field} must be true or false`)
  return v
}

function httpsUrl(v: unknown, field: string): string | null {
  const s = optionalText(v, field, 2048)
  if (s !== null && !/^https:\/\//i.test(s)) return bad(`${field} must be an https:// link`)
  return s
}

/** Copies only the listed keys that are present, through their parser. */
function pick<T>(body: Body, parsers: { [K in keyof T]-?: (v: unknown) => T[K] }): Partial<T> {
  const out: Partial<T> = {}
  for (const key of Object.keys(parsers) as (keyof T)[]) {
    if (Object.hasOwn(body, key)) out[key] = parsers[key](body[key as string])
  }
  return out
}

// ─── Encounters and presets ──────────────────────────────────────────────────

const sceneParsers = {
  description: (v: unknown) => optionalText(v, 'Description', 2000),
  background_url: (v: unknown) => httpsUrl(v, 'Backdrop'),
}

export function newEncounter(body: Body): NewEncounter {
  return {
    title: text(body.title, 'Title', 120, 1),
    description: sceneParsers.description(body.description ?? null),
    background_url: sceneParsers.background_url(body.background_url ?? null),
  }
}

export function encounterPatch(body: Body): EncounterPatch {
  return pick<EncounterPatch>(body, {
    title: (v) => text(v, 'Title', 120, 1),
    ...sceneParsers,
    round: (v) => int(v, 'Round', 1, 10_000),
    active_creature_id: (v) => (v === null ? null : text(v, 'Active creature', 64, 1)),
    share_enabled: (v) => bool(v, 'Sharing'),
    hidden: (v) => bool(v, 'Hidden'),
    campaign_id: (v) => (v === null ? null : text(v, 'Folder', 64, 1)),
  })
}

export function newPreset(body: Body): PresetFields {
  return {
    name: text(body.name, 'Name', 120, 1),
    description: sceneParsers.description(body.description ?? null),
    background_url: sceneParsers.background_url(body.background_url ?? null),
  }
}

export function presetPatch(body: Body): PresetPatch {
  return pick<PresetPatch>(body, { name: (v) => text(v, 'Name', 120, 1), ...sceneParsers, hidden: (v) => bool(v, 'Hidden') })
}

// ─── Character sheets ────────────────────────────────────────────────────────

function list(v: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(v)) return bad(`${field} must be a list`)
  if (v.length > max) return bad(`${field} can have at most ${max} entries`)
  return v
}

function object(v: unknown, field: string): Body {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return bad(`${field} must be an object`)
  return v as Body
}

function ability(v: unknown, field: string): Ability {
  if (!ABILITY_KEYS.includes(v as Ability)) return bad(`${field} must be one of ${ABILITY_KEYS.join(', ')}`)
  return v as Ability
}

function slots(v: unknown, field: string) {
  const s = object(v, field)
  const max = int(s.max, `${field} total`, 0, 20)
  return { level: int(s.level, `${field} level`, 1, 9), max, used: Math.min(max, int(s.used ?? 0, `${field} used`, 0, 20)) }
}

/** A whole sheet: the form always sends every part, so nothing here is partial. */
export function sheet(v: unknown): CharacterSheet {
  const s = object(v, 'Character sheet')
  const scores = object(s.abilities, 'Ability scores')
  const skills = object(s.skills ?? {}, 'Skills')
  const abilities = {} as Record<Ability, number>
  for (const key of ABILITY_KEYS) abilities[key] = int(scores[key], `${key.toUpperCase()} score`, 1, 30)
  const skillOut: Partial<Record<Skill, Proficiency>> = {}
  for (const [key, level] of Object.entries(skills)) {
    if (!SKILL_KEYS.includes(key as Skill)) return bad(`Unknown skill ${key}`)
    if (level !== 'proficient' && level !== 'expertise') return bad('Skills are proficient or expertise')
    skillOut[key as Skill] = level
  }
  return {
    species: optionalText(s.species ?? null, 'Species', 60),
    background: optionalText(s.background ?? null, 'Background', 60),
    classes: list(s.classes ?? [], 'Classes', 12).map((c) => {
      const o = object(c, 'Class')
      return { name: text(o.name, 'Class', 40, 1), subclass: optionalText(o.subclass ?? null, 'Subclass', 60), level: int(o.level, 'Class level', 1, 20) }
    }),
    speed: optionalInt(s.speed ?? null, 'Speed', 0, 500),
    abilities,
    saves: [...new Set(list(s.saves ?? [], 'Saving throws', 6).map((a) => ability(a, 'Saving throw')))],
    skills: skillOut,
    spellcasting_ability: s.spellcasting_ability == null ? null : ability(s.spellcasting_ability, 'Spellcasting ability'),
    spell_slots: list(s.spell_slots ?? [], 'Spell slots', 9).map((x) => slots(x, 'Spell slots')),
    pact_slots: s.pact_slots == null ? null : slots(s.pact_slots, 'Pact slots'),
    inventory: list(s.inventory ?? [], 'Inventory', 200).map((x) => {
      const o = object(x, 'Item')
      return { name: text(o.name, 'Item name', 80, 1), quantity: int(o.quantity ?? 1, 'Quantity', 0, 9999), equipped: o.equipped === true }
    }),
    player_notes: optionalText(s.player_notes ?? null, 'Notes', 8000),
    source_url: httpsUrl(s.source_url ?? null, 'Source link'),
  }
}

// ─── Creatures ───────────────────────────────────────────────────────────────

export const MAX_CREATURES = 200

export function conditions(v: unknown): Condition[] {
  if (!Array.isArray(v)) return bad('Conditions must be a list')
  if (v.length > 40) return bad('A creature can have at most 40 conditions')
  return v.map((c): Condition => {
    if (typeof c !== 'object' || c === null) return bad('Each condition must be an object')
    const { key, label, rounds } = c as Record<string, unknown>
    return {
      key: text(key, 'Condition', 80, 1),
      ...(label !== undefined && label !== null && label !== '' ? { label: text(label, 'Condition label', 60) } : {}),
      rounds: optionalInt(rounds ?? null, 'Condition rounds', 1, 1000),
    }
  })
}

const creatureParsers: { [K in keyof CreaturePatch]-?: (v: unknown) => CreaturePatch[K] } = {
  name: (v) => text(v, 'Name', 80, 1),
  is_player: (v) => bool(v, 'Player character'),
  initiative: (v) => int(v, 'Initiative', -100, 100),
  initiative_bonus: (v) => int(v, 'Initiative bonus', -20, 30),
  max_hp: (v) => optionalInt(v, 'Max HP', 1, 100_000),
  current_hp: (v) => optionalInt(v, 'Current HP', 0, 100_000),
  temp_hp: (v) => int(v, 'Temp HP', 0, 100_000),
  armor_class: (v) => optionalInt(v, 'Armor class', 0, 50),
  conditions,
  notes: (v) => optionalText(v, 'Notes', 4000),
  image_url: (v) => httpsUrl(v, 'Portrait'),
  hidden: (v) => bool(v, 'Hidden'),
  sheet: (v) => (v === null ? null : sheet(v)),
}

/** What a player may change about their own character, in a campaign and in a fight. */
export const PLAYER_SHEET_FIELDS = ['name', 'image_url', 'initiative_bonus', 'max_hp', 'armor_class', 'sheet'] as const
/** In a fight a player changes their HP and conditions, and their sheet (spending spell slots) when it isn't a campaign character. */
export const PLAYER_COMBAT_FIELDS = ['current_hp', 'temp_hp', 'conditions', 'sheet'] as const

export function onlyFields(patch: CreaturePatch, allowed: readonly (keyof CreaturePatch)[]): CreaturePatch {
  const extra = Object.keys(patch).filter((k) => !allowed.includes(k as keyof CreaturePatch))
  if (extra.length) throw new HttpError(403, 'Only the DM can change that')
  return patch
}

export function creaturePatch(body: Body): CreaturePatch {
  return pick<CreaturePatch>(body, creatureParsers)
}

export function newCreatures(body: Body): NewCreature[] {
  const list = body.creatures
  if (!Array.isArray(list) || list.length === 0) return bad('Send at least one creature')
  if (list.length > 50) return bad('Add at most 50 creatures at a time')
  return list.map((c) => {
    if (typeof c !== 'object' || c === null || Array.isArray(c)) return bad('Each creature must be an object')
    return newCreature(c as Body)
  })
}

function newCreature(body: Body): NewCreature {
  const patch = creaturePatch(body)
  if (patch.name === undefined) return bad('Every creature needs a name')
  return { ...patch, name: patch.name }
}

export function characterChoice(body: Body): CharacterChoice {
  if (typeof body.claim === 'string') return { claim: text(body.claim, 'Character', 64, 1) }
  if (body.create !== undefined) {
    // A player's own character is always a visible PC.
    return { create: { ...newCreature(object(body.create, 'Character')), is_player: true, hidden: false } }
  }
  return bad('Pick a character or create one')
}

// ─── Membership ──────────────────────────────────────────────────────────────

export function role(v: unknown): Role {
  if (v !== 'player' && v !== 'dm') return bad('Role must be player or dm')
  return v
}

export function mode(v: unknown): Mode {
  if (v !== 'player' && v !== 'dm') return bad('Mode must be player or dm')
  return v
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export function email(v: unknown): string {
  const s = text(v, 'Email', 254, 1).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return bad('That doesn’t look like an email address')
  return s
}

export function password(v: unknown): string {
  // Not trimmed: spaces are legitimate password characters.
  if (typeof v !== 'string') return bad('Password must be text')
  if (v.length < 8) return bad('Use at least 8 characters for your password')
  if (v.length > 200) return bad('Passwords can be at most 200 characters')
  return v
}

export const username = (v: unknown): string => text(v, 'Username', 40, 1)

// ─── Personal folders ────────────────────────────────────────────────────────

const MAX_FOLDERS = 100
const MAX_FILED = 2000

/** The whole folder list, replaced in one go. Filings that point at a missing folder are dropped. */
export function folders(body: Body): Folders {
  if (!Array.isArray(body.folders)) return bad('Folders must be a list')
  if (body.folders.length > MAX_FOLDERS) return bad(`You can have at most ${MAX_FOLDERS} folders`)
  const list = body.folders.map((f) => {
    const raw = object(f, 'Folder')
    return { id: text(raw.id, 'Folder id', 64, 1), name: text(raw.name, 'Folder name', 60, 1), side: mode(raw.side) }
  })
  if (new Set(list.map((f) => f.id)).size !== list.length) return bad('Two folders share an id')
  const ids = new Set(list.map((f) => f.id))
  const filedIn = object(body.filed ?? {}, 'Filed')
  const entries = Object.entries(filedIn)
  if (entries.length > MAX_FILED) return bad('Too many filed encounters')
  const filed: Record<string, string> = {}
  for (const [encounterId, folderId] of entries) {
    if (typeof folderId === 'string' && ids.has(folderId) && encounterId.length <= 64) filed[encounterId] = folderId
  }
  return { folders: list, filed }
}
