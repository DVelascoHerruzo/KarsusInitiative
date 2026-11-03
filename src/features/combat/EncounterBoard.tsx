import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Dices, Keyboard, Plus, RotateCcw, Swords } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmDelete from '@/components/ui/ConfirmDelete'
import { copyName, duplicateCreature, nextUp, sortByInitiative, type HpResult } from '@/lib/combat'
import { d20Notation, rollDice } from '@/lib/dice'
import type { ImageKind } from '@/lib/images'
import type { Condition, Creature, CreaturePatch, Encounter, EncounterPatch, NewCreature } from '@/lib/types'
import { useHotkeys } from '@/lib/useHotkeys'
import { DicePanel } from '@/features/dice/DicePanel'
import { ConditionsDialog } from './ConditionsDialog'
import { CreatureFormDialog, type CreatureFormTarget } from './CreatureFormDialog'
import CreatureRow from './CreatureRow'
import { HpDialog, type HpMode } from './HpDialog'
import { ShortcutsDialog } from './ShortcutsDialog'

export interface BoardActions {
  advance: (step: 1 | -1) => void
  updateCreature: (id: string, patch: CreaturePatch) => void
  addCreatures: (creatures: NewCreature[]) => unknown
  removeCreature: (id: string) => void
  updateEncounter: (patch: EncounterPatch) => void
  upload?: (file: File, kind: ImageKind) => Promise<string>
}

interface EncounterBoardProps {
  encounter: Encounter
  actions: BoardActions
  /** Usernames by account id, to show who plays each PC. */
  playerNames?: ReadonlyMap<string, string>
}

/**
 * The DM's combat screen: round and turn controls on top, then every creature
 * in initiative order with inline editing, and the dice roller alongside.
 * Purely presentational over `actions`, so the live page and the offline demo
 * share it.
 */
export function EncounterBoard({ encounter, actions, playerNames }: EncounterBoardProps) {
  const ordered = useMemo(() => sortByInitiative(encounter.creatures), [encounter.creatures])
  const started = encounter.active_creature_id !== null
  const activeIdx = ordered.findIndex((c) => c.id === encounter.active_creature_id)
  const active = activeIdx >= 0 ? ordered[activeIdx]! : null
  const next = useMemo(() => nextUp(ordered, encounter.active_creature_id), [ordered, encounter.active_creature_id])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = ordered.find((c) => c.id === selectedId) ?? active ?? ordered[0] ?? null

  const [hpTarget, setHpTarget] = useState<{ id: string; mode: HpMode } | null>(null)
  const [conditionsId, setConditionsId] = useState<string | null>(null)
  const [formTarget, setFormTarget] = useState<CreatureFormTarget | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Creature | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const diceInput = useRef<HTMLInputElement>(null)

  // Look creatures up by id so dialogs always show fresh data after live updates.
  const byId = (id: string | null | undefined) => (id ? (encounter.creatures.find((c) => c.id === id) ?? null) : null)

  function step(dir: 1 | -1) {
    if (ordered.length === 0) return
    setSelectedId(null) // selection follows the turn
    actions.advance(dir)
  }

  function applyHp(c: Creature, result: HpResult) {
    actions.updateCreature(c.id, result.patch)
    if (result.droppedToZero) toast(c.is_player ? `${c.name} falls unconscious` : `${c.name} is slain`)
    if (result.concentrationDc) toast(`${c.name}: concentration check`, { description: `Constitution save, DC ${result.concentrationDc}` })
  }

  function rollMonsters() {
    const monsters = encounter.creatures.filter((c) => !c.is_player)
    if (monsters.length === 0) return toast('No monsters to roll for')
    for (const m of monsters) actions.updateCreature(m.id, { initiative: rollDice(d20Notation(m.initiative_bonus)).total })
    toast.success(`Rolled initiative for ${monsters.length} monster${monsters.length === 1 ? '' : 's'}`)
  }

  async function duplicate(c: Creature) {
    const { rename, copy } = copyName(c.name, encounter.creatures.map((x) => x.name))
    if (rename) actions.updateCreature(c.id, { name: rename })
    await actions.addCreatures([duplicateCreature(c, copy, (bonus) => rollDice(d20Notation(bonus)).total)])
    toast.success(`${copy} joins the fight`)
  }

  function moveSelection(dir: 1 | -1) {
    if (ordered.length === 0) return
    const idx = selected ? ordered.findIndex((c) => c.id === selected.id) : -1
    setSelectedId(ordered[(idx + dir + ordered.length) % ordered.length]!.id)
  }

  useHotkeys({
    space: () => step(1),
    arrowright: () => step(1),
    'shift+space': () => step(-1),
    arrowleft: () => step(-1),
    arrowdown: () => moveSelection(1),
    j: () => moveSelection(1),
    arrowup: () => moveSelection(-1),
    k: () => moveSelection(-1),
    d: () => selected && setHpTarget({ id: selected.id, mode: 'damage' }),
    h: () => selected && setHpTarget({ id: selected.id, mode: 'heal' }),
    t: () => selected && setHpTarget({ id: selected.id, mode: 'temp' }),
    c: () => selected && setConditionsId(selected.id),
    e: () => selected && setFormTarget({ mode: 'edit', creature: selected }),
    a: () => setFormTarget({ mode: 'add' }),
    i: rollMonsters,
    r: () => diceInput.current?.focus(),
    '?': () => setShowShortcuts(true),
  })

  return (
    <div className="space-y-6">
      {/* ── Round / turn controls ─────────────────────────────────── */}
      <section aria-label="Turn" className="dnd-card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center">
            <p className="font-body text-xs tracking-widest text-dnd-muted">ROUND</p>
            <p className="font-display text-3xl text-dnd-gold">{encounter.round}</p>
          </div>
          <div className="text-center">
            <p className="font-body text-xs tracking-widest text-dnd-muted">TURN</p>
            <p className="font-display text-3xl text-dnd-parchment">
              {activeIdx + 1}
              <span className="text-lg text-dnd-muted">/{ordered.length}</span>
            </p>
          </div>
          <div className="min-w-0" aria-live="polite">
            <p className="font-body text-xs tracking-widest text-dnd-muted">{active ? 'ACTIVE' : 'STATUS'}</p>
            {active ? (
              <p className="font-body text-dnd-parchment">
                <span className="sr-only">Now acting: </span>
                {active.name}
              </p>
            ) : (
              <p className="font-ui text-dnd-parchment italic">{ordered.length ? 'Combat hasn’t started' : 'No combatants yet'}</p>
            )}
            {next && (
              <p className="font-ui text-xs text-dnd-muted italic">
                {started ? 'Then' : 'First up:'} {next.name}
              </p>
            )}
            {!started && ordered.some((c) => !c.is_player) && (
              <p className="font-ui text-xs text-dnd-jade/80 italic">Players see only the party until you start.</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={rollMonsters} disabled={!ordered.length} className="dnd-button-ghost px-3" title="Roll initiative for every monster (I)">
            <Dices className="h-4 w-4" /> <span className="max-sm:sr-only">Roll monsters</span>
          </button>
          {started && (
            <button type="button" onClick={() => setConfirmReset(true)} className="dnd-button-ghost px-3" title="Reset combat">
              <RotateCcw className="h-4 w-4" /> <span className="sr-only">Reset combat</span>
            </button>
          )}
          <button type="button" onClick={() => setShowShortcuts(true)} className="dnd-button-ghost px-3 max-sm:hidden" title="Keyboard shortcuts (?)">
            <Keyboard className="h-4 w-4" /> <span className="sr-only">Keyboard shortcuts</span>
          </button>
          {started ? (
            <>
              <button type="button" onClick={() => step(-1)} aria-keyshortcuts="Shift+Space ArrowLeft" className="dnd-button-secondary px-4 py-2">
                <ChevronLeft className="h-4 w-4" /> Prev Turn
              </button>
              <button type="button" onClick={() => step(1)} aria-keyshortcuts="Space ArrowRight" className="dnd-button-primary px-4 py-2">
                Next Turn <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button type="button" onClick={() => step(1)} disabled={!ordered.length} aria-keyshortcuts="Space" className="dnd-button-primary px-4 py-2">
              <Swords className="h-4 w-4" /> Start Combat
            </button>
          )}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Creatures ──────────────────────────────────────────── */}
        <section aria-labelledby="creatures-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="creatures-heading" className="font-body text-lg tracking-widest text-dnd-parchment uppercase">
              Creatures <span className="text-sm text-dnd-muted">({ordered.length})</span>
            </h2>
            <button type="button" onClick={() => setFormTarget({ mode: 'add' })} aria-keyshortcuts="A" className="dnd-button-secondary px-3 py-1.5 text-sm">
              <Plus className="h-4 w-4" /> Add Creature
            </button>
          </div>

          {ordered.length === 0 ? (
            <div className="dnd-card p-10 text-center">
              <p className="font-ui text-dnd-muted italic">No creatures yet. Add the combatants!</p>
              <p className="mt-1 font-ui text-xs text-dnd-muted/70 italic">Leave initiative blank and it’s rolled for you.</p>
              <button type="button" onClick={() => setFormTarget({ mode: 'add' })} className="dnd-button-secondary mt-4 text-sm">
                <Plus className="h-4 w-4" /> Add Creature
              </button>
            </div>
          ) : (
            <ol className="space-y-1.5" aria-label="Initiative order">
              {ordered.map((c) => (
                <CreatureRow
                  key={c.id}
                  creature={c}
                  isActive={c.id === active?.id}
                  isNext={c.id === next?.id}
                  selected={c.id === selected?.id}
                  playedBy={c.player_id ? playerNames?.get(c.player_id) : undefined}
                  onSelect={() => setSelectedId(c.id)}
                  onSave={(patch) => actions.updateCreature(c.id, patch)}
                  onDelete={() => setRemoveTarget(c)}
                  onDuplicate={() => void duplicate(c).catch(() => {})}
                  onHp={() => setHpTarget({ id: c.id, mode: 'damage' })}
                  onConditions={() => setConditionsId(c.id)}
                  onEdit={() => setFormTarget({ mode: 'edit', creature: c })}
                  upload={actions.upload}
                />
              ))}
            </ol>
          )}
          <p className="mt-3 hidden font-ui text-xs text-dnd-muted/70 italic sm:block">
            Space next turn · J/K select · D damage · H heal · C conditions · ? everything else
          </p>
        </section>

        <DicePanel inputRef={diceInput} />
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <HpDialog creature={byId(hpTarget?.id)} initialMode={hpTarget?.mode ?? 'damage'} onClose={() => setHpTarget(null)} onApply={applyHp} />
      <ConditionsDialog
        creature={byId(conditionsId)}
        onClose={() => setConditionsId(null)}
        onChange={(c, conditions: Condition[]) => actions.updateCreature(c.id, { conditions })}
      />
      <CreatureFormDialog
        target={formTarget}
        context="encounter"
        existingNames={encounter.creatures.map((c) => c.name)}
        onClose={() => setFormTarget(null)}
        onAdd={actions.addCreatures}
        onEdit={actions.updateCreature}
        upload={actions.upload}
      />
      <ConfirmDelete
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        name={removeTarget?.name}
        title="Remove Creature"
        confirmLabel="Remove"
        body={
          <>
            Remove <span className="font-body text-dnd-gold">“{removeTarget?.name}”</span> from the fight?
            <br />
            <span className="text-sm text-dnd-muted">If it’s their turn, play passes to the next creature.</span>
          </>
        }
        onConfirm={() => {
          if (removeTarget) actions.removeCreature(removeTarget.id)
          setRemoveTarget(null)
        }}
      />
      <ConfirmDelete
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset Combat"
        confirmLabel="Reset"
        body="Go back to round 1 with no one acting? HP and conditions are kept."
        onConfirm={() => {
          actions.updateEncounter({ round: 1, active_creature_id: null })
          setConfirmReset(false)
        }}
      />
      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  )
}
