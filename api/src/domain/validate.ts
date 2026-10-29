import { HttpError } from '../http'
import type { Condition, CreaturePatch, EncounterPatch, NewCreature, NewEncounter, PresetFields } from '@/lib/types'

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
  })
}

export function newPreset(body: Body): PresetFields {
  return {
    name: text(body.name, 'Name', 120, 1),
    description: sceneParsers.description(body.description ?? null),
    background_url: sceneParsers.background_url(body.background_url ?? null),
  }
}

export function presetPatch(body: Body): Partial<PresetFields> {
  return pick<PresetFields>(body, { name: (v) => text(v, 'Name', 120, 1), ...sceneParsers })
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
    const patch = creaturePatch(c as Body)
    if (patch.name === undefined) return bad('Every creature needs a name')
    return { ...patch, name: patch.name }
  })
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
