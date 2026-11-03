import { hasCondition, withCondition, withoutCondition } from './conditions'
import type { Condition, Creature, CreaturePatch, HealthBand, NewCreature } from './types'

type Orderable = Pick<Creature, 'id' | 'initiative' | 'initiative_bonus' | 'created_at'>

/** Turn order: initiative, then initiative bonus (the usual 5e tiebreak), then insertion order. */
export function compareInitiative(a: Orderable, b: Orderable): number {
  return (
    b.initiative - a.initiative ||
    b.initiative_bonus - a.initiative_bonus ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  )
}

export function sortByInitiative<T extends Orderable>(creatures: readonly T[]): T[] {
  return [...creatures].sort(compareInitiative)
}

type TurnCreature = Orderable & Pick<Creature, 'conditions'>

export interface TurnState<T extends TurnCreature> {
  round: number
  activeId: string | null
  creatures: T[]
}

function tickConditions(conditions: readonly Condition[]): Condition[] {
  return conditions.flatMap((c) => {
    if (c.rounds === null) return [c]
    return c.rounds > 1 ? [{ ...c, rounds: c.rounds - 1 }] : []
  })
}

/**
 * The turn engine. The API runs this to advance turns, and the DM screen runs it
 * too for its optimistic update and the offline demo, so all three always agree.
 */
export function advanceTurn<T extends TurnCreature>(state: TurnState<T>, step: 1 | -1): TurnState<T> {
  const ordered = sortByInitiative(state.creatures)
  const n = ordered.length
  if (n === 0) return { ...state, activeId: null }

  let creatures = state.creatures
  let round = state.round
  let pos = ordered.findIndex((c) => c.id === state.activeId)

  if (pos === -1) {
    pos = step === 1 ? -1 : 0
  } else if (step === 1) {
    const endingId = state.activeId
    creatures = creatures.map((c) => (c.id === endingId ? { ...c, conditions: tickConditions(c.conditions) } : c))
  }

  for (let i = 0; i < n; i++) {
    pos += step
    if (pos >= n) {
      pos = 0
      round += 1
    } else if (pos < 0) {
      pos = n - 1
      round = Math.max(1, round - 1)
    }
    if (!hasCondition(ordered[pos]!.conditions, 'dead')) break
  }

  return { round, activeId: ordered[pos]!.id, creatures }
}

/** Who acts after the current creature, or first before combat starts. Skips the dead. */
export function nextUp<T extends Pick<Creature, 'id' | 'conditions'>>(ordered: readonly T[], activeId: string | null): T | null {
  const at = ordered.findIndex((c) => c.id === activeId)
  const count = at === -1 ? ordered.length : ordered.length - 1
  for (let i = 0; i < count; i++) {
    const c = ordered[(at + 1 + i) % ordered.length]!
    if (!hasCondition(c.conditions, 'dead')) return c
  }
  return null
}

export interface TurnPosition {
  round: number
  /** Index of the acting creature in initiative order; -1 before combat starts. */
  index: number
}

/** Which way the turn moved, so the stage can slide the right way. Wrapping into a new round is forward. */
export function turnDirection(from: TurnPosition, to: TurnPosition): 1 | -1 {
  if (to.round !== from.round) return to.round > from.round ? 1 : -1
  return to.index >= from.index ? 1 : -1
}

// ─── Hit points ──────────────────────────────────────────────────────────────

type HpCreature = Pick<Creature, 'name' | 'is_player' | 'current_hp' | 'max_hp' | 'temp_hp' | 'conditions'>

export interface HpResult {
  patch: CreaturePatch
  /** Set when a concentrating creature takes damage and stays up. */
  concentrationDc?: number
  droppedToZero?: boolean
}

/** Temp HP soaks first. Hitting 0 marks monsters dead and players unconscious (and ends concentration). */
export function applyDamage(c: HpCreature, amount: number): HpResult {
  const dmg = Math.max(0, Math.floor(amount))
  if (dmg === 0 || c.current_hp === null) return { patch: {} }

  const soaked = Math.min(c.temp_hp, dmg)
  const temp_hp = c.temp_hp - soaked
  const current_hp = Math.max(0, c.current_hp - (dmg - soaked))
  const patch: CreaturePatch = { temp_hp, current_hp }

  if (current_hp === 0 && c.current_hp > 0) {
    const state = c.is_player ? 'unconscious' : 'dead'
    patch.conditions = withCondition(withoutCondition(c.conditions, 'concentrating'), { key: state, rounds: null })
    return { patch, droppedToZero: true }
  }

  if (hasCondition(c.conditions, 'concentrating') && current_hp > 0) {
    return { patch, concentrationDc: Math.min(30, Math.max(10, Math.floor(dmg / 2))) }
  }
  return { patch }
}

/** Healing from 0 brings a creature back up and clears unconscious/dead. */
export function applyHealing(c: HpCreature, amount: number): HpResult {
  const heal = Math.max(0, Math.floor(amount))
  if (heal === 0 || c.current_hp === null) return { patch: {} }

  const max = c.max_hp ?? Number.POSITIVE_INFINITY
  const current_hp = Math.min(max, c.current_hp + heal)
  const patch: CreaturePatch = { current_hp }
  if (c.current_hp === 0 && current_hp > 0) {
    patch.conditions = withoutCondition(c.conditions, 'unconscious', 'dead')
  }
  return { patch }
}

/** Temporary HP doesn't stack — keep whichever pool is larger. */
export function grantTempHp(c: Pick<Creature, 'temp_hp'>, amount: number): HpResult {
  const value = Math.max(0, Math.floor(amount))
  return { patch: value > c.temp_hp ? { temp_hp: value } : {} }
}

/** Keep in sync with the health CASE in get_shared_encounter. */
export function healthBand(current: number | null, max: number | null): HealthBand | null {
  if (current === null || max === null) return null
  if (current === 0) return 'down'
  if (current * 4 <= max) return 'critical'
  if (current * 2 <= max) return 'bloodied'
  if (current < max) return 'wounded'
  return 'healthy'
}

export const HEALTH_LABEL: Record<HealthBand, string> = {
  healthy: 'Unhurt',
  wounded: 'Wounded',
  bloodied: 'Bloodied',
  critical: 'Near death',
  down: 'Down',
}

export function hpFraction(current: number | null, max: number | null): number | null {
  if (current === null || max === null || max <= 0) return null
  return Math.max(0, Math.min(1, current / max))
}

/** "Goblin" ×3 → Goblin 1, Goblin 2, Goblin 3 (continuing past any existing numbers). */
export function numberedNames(base: string, count: number, existing: readonly string[]): string[] {
  const name = base.trim()
  if (count <= 1 && !existing.includes(name)) return [name]
  let next = Math.max(0, ...takenNumbers(name, existing)) + 1
  return Array.from({ length: count }, () => `${name} ${next++}`)
}

/** The numbers already used after `base`: "Goblin 2", "Goblin 5" → [2, 5]. */
function takenNumbers(base: string, existing: readonly string[]): number[] {
  const pattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`)
  return existing.flatMap((n) => {
    const m = pattern.exec(n)
    return m ? [Number(m[1])] : []
  })
}

/**
 * Names for a duplicate. Copying "Goblin" makes it "Goblin 1" and adds "Goblin 2";
 * copying any numbered goblin adds the next free number.
 */
export function copyName(name: string, existing: readonly string[]): { rename: string | null; copy: string } {
  const numbered = / (\d+)$/.exec(name)
  const base = numbered ? name.slice(0, numbered.index) : name
  const taken = takenNumbers(base, existing)
  if (!numbered && taken.length === 0) return { rename: `${base} 1`, copy: `${base} 2` }
  return { rename: null, copy: `${base} ${Math.max(0, ...taken) + 1}` }
}

/** A fresh copy of a creature: same stats, full HP, no conditions; monsters in a fight roll their own initiative. */
export function duplicateCreature(c: Creature, name: string, rollInitiative?: (bonus: number) => number): NewCreature {
  return {
    name,
    is_player: c.is_player,
    initiative: rollInitiative && !c.is_player ? rollInitiative(c.initiative_bonus) : c.initiative,
    initiative_bonus: c.initiative_bonus,
    max_hp: c.max_hp,
    current_hp: c.max_hp,
    temp_hp: 0,
    armor_class: c.armor_class,
    conditions: [],
    notes: c.notes,
    image_url: c.image_url,
    hidden: c.hidden,
    sheet: c.sheet && structuredClone(c.sheet),
  }
}

/**
 * Who the players may see: never hidden creatures, and before combat starts only
 * the party, so the DM can set the scene and hide what should stay hidden first.
 */
export function visibleToPlayers<T extends Pick<Creature, 'hidden' | 'is_player'>>(creatures: readonly T[], started: boolean): T[] {
  return creatures.filter((c) => !c.hidden && (started || c.is_player))
}
