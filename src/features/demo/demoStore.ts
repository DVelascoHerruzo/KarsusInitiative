import { useSyncExternalStore } from 'react'
import { advanceTurn } from '@/lib/combat'
import { parseConditions } from '@/lib/conditions'
import type { BoardActions } from '@/features/combat/EncounterBoard'
import type { Creature, Encounter } from '@/lib/types'

/**
 * The offline demo: one encounter in localStorage, mirrored to other tabs (the demo
 * player view) over BroadcastChannel. Uses the same turn engine as the real app.
 */

const STORAGE_KEY = 'karsus:demo:v1'
const ENCOUNTER_ID = 'demo'

const t0 = Date.parse('2026-01-01T00:00:00Z')
let seq = 0
const stamp = () => new Date(t0 + seq++ * 1000).toISOString()

function creature(c: Partial<Creature> & Pick<Creature, 'name' | 'initiative'>): Creature {
  return {
    id: crypto.randomUUID(),
    owner_id: 'demo',
    encounter_id: ENCOUNTER_ID,
    preset_id: null,
    is_player: false,
    initiative_bonus: 0,
    max_hp: null,
    current_hp: null,
    temp_hp: 0,
    armor_class: null,
    conditions: [],
    notes: null,
    image_url: null,
    created_at: stamp(),
    ...c,
  }
}

export function seedEncounter(): Encounter {
  seq = 0
  const creatures = [
    creature({ name: 'Vex', is_player: true, initiative: 21, initiative_bonus: 4, max_hp: 33, current_hp: 27, armor_class: 15, notes: 'Sneak Attack 3d6. Cunning Action to hide.' }),
    creature({ name: 'Hobgoblin Captain', initiative: 17, initiative_bonus: 1, max_hp: 39, current_hp: 24, armor_class: 17, conditions: [{ key: 'frightened', rounds: 1 }], notes: 'Leadership (recharges after a short rest): allies within 30 ft add 1d4 to attacks and saves.\nMultiattack: 2 greatsword, 2d6+3.' }),
    creature({ name: 'Brother Aldric', is_player: true, initiative: 14, max_hp: 31, current_hp: 18, temp_hp: 5, armor_class: 18, conditions: [{ key: 'concentrating', rounds: null }, { key: 'custom:bless', label: 'Bless', rounds: 7 }] }),
    creature({ name: 'Goblin 1', initiative: 13, initiative_bonus: 2, max_hp: 7, current_hp: 0, armor_class: 15, conditions: [{ key: 'dead', rounds: null }] }),
    creature({ name: 'Goblin 2', initiative: 13, initiative_bonus: 2, max_hp: 7, current_hp: 3, armor_class: 15, conditions: [{ key: 'prone', rounds: null }], notes: 'Nimble Escape: Disengage or Hide as a bonus action.' }),
    creature({ name: 'Worg', initiative: 11, initiative_bonus: 1, max_hp: 26, current_hp: 26, armor_class: 13, notes: 'Bite 2d6+3. DC 13 Str save or knocked prone.' }),
    creature({ name: 'Thorne', is_player: true, initiative: 8, initiative_bonus: -1, max_hp: 44, current_hp: 44, armor_class: 20, conditions: [{ key: 'poisoned', rounds: 2 }] }),
  ]
  return {
    id: ENCOUNTER_ID,
    owner_id: 'demo',
    title: 'Ambush at Hollow Ford',
    description: 'Rain hammers the old stone bridge. Shapes move in the reeds.',
    background_url: null,
    round: 2,
    active_creature_id: creatures[2]!.id,
    share_token: 'demo',
    share_enabled: true,
    created_at: stamp(),
    updated_at: stamp(),
    creatures,
  }
}

function load(): Encounter {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Encounter
      return { ...parsed, creatures: parsed.creatures.map((c) => ({ ...c, conditions: parseConditions(c.conditions) })) }
    }
  } catch {
    // Corrupt or blocked storage: fall through to a fresh seed.
  }
  return seedEncounter()
}

let state: Encounter | null = null
const listeners = new Set<() => void>()
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('karsus-demo')

channel?.addEventListener('message', () => {
  state = load()
  listeners.forEach((l) => l())
})

function current(): Encounter {
  return (state ??= load())
}

function commit(next: Encounter) {
  state = { ...next, updated_at: new Date().toISOString() }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or disabled: the demo still works in memory.
  }
  channel?.postMessage('changed')
  listeners.forEach((l) => l())
}

const update = (fn: (e: Encounter) => Encounter) => commit(fn(current()))

export function resetDemo() {
  commit(seedEncounter())
}

export function useDemoEncounter(): Encounter {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    current,
    current,
  )
}

function step(e: Encounter, dir: 1 | -1): Encounter {
  const next = advanceTurn({ round: e.round, activeId: e.active_creature_id, creatures: e.creatures }, dir)
  return { ...e, round: next.round, active_creature_id: next.activeId, creatures: next.creatures }
}

export const demoActions: BoardActions = {
  advance: (dir) => update((e) => step(e, dir)),
  updateCreature: (id, patch) =>
    update((e) => ({ ...e, creatures: e.creatures.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  addCreatures: (input) =>
    update((e) => ({
      ...e,
      creatures: [
        ...e.creatures,
        ...input.map((c) => creature({ ...c, conditions: c.conditions ?? [], created_at: new Date(Date.now() + seq++).toISOString() } as Creature)),
      ],
    })),
  removeCreature: (id) =>
    update((e) => {
      const passed = e.active_creature_id === id ? step(e, 1) : e
      const creatures = passed.creatures.filter((c) => c.id !== id)
      return { ...passed, creatures, active_creature_id: passed.active_creature_id === id ? null : passed.active_creature_id }
    }),
  updateEncounter: (patch) => update((e) => ({ ...e, ...patch })),
}
