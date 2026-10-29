import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Dices, Keyboard, Plus, RotateCcw, Swords, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Kbd } from '@/components/ui/display'
import { nextUp, sortByInitiative, type HpResult } from '@/lib/combat'
import { d20Notation, rollDice } from '@/lib/dice'
import type { ImageKind } from '@/lib/images'
import type { Condition, Creature, CreaturePatch, Encounter, EncounterPatch, NewCreature } from '@/lib/types'
import { useHotkeys } from '@/lib/useHotkeys'
import { DicePanel } from '@/features/dice/DicePanel'
import { Board, Cascade, CascadeRow } from './Cascade'
import { ConditionsDialog } from './ConditionsDialog'
import { CreatureFormDialog, type CreatureFormTarget } from './CreatureFormDialog'
import { HpDialog, type HpMode } from './HpDialog'
import { InitiativeRow } from './InitiativeRow'
import { ShortcutsDialog } from './ShortcutsDialog'
import { SpotlightCard } from './SpotlightCard'
import { RoundBox, StageCaption } from './StageParts'
import { TurnStage, useTurnDirection } from './TurnStage'

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
}

/**
 * The DM's combat screen: the acting creature's portrait on the left wall, the
 * initiative order cascading down its edge, and a command column on the right.
 * Purely presentational over `actions`, so the live page (the Azure API) and the
 * offline demo (local state) share every pixel of it.
 */
export function EncounterBoard({ encounter, actions }: EncounterBoardProps) {
  const ordered = useMemo(() => sortByInitiative(encounter.creatures), [encounter.creatures])
  const started = encounter.active_creature_id !== null
  const activeIdx = ordered.findIndex((c) => c.id === encounter.active_creature_id)
  const active = activeIdx >= 0 ? ordered[activeIdx]! : null
  const next = useMemo(() => nextUp(ordered, encounter.active_creature_id), [ordered, encounter.active_creature_id])
  const direction = useTurnDirection({ round: encounter.round, index: activeIdx })

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
    if (result.concentrationDc) {
      toast(`${c.name}: concentration check`, { description: `Constitution save, DC ${result.concentrationDc}` })
    }
  }

  function rollMonsters() {
    const monsters = encounter.creatures.filter((c) => !c.is_player)
    if (monsters.length === 0) return toast('No monsters to roll for')
    for (const m of monsters) actions.updateCreature(m.id, { initiative: rollDice(d20Notation(m.initiative_bonus)).total })
    toast.success(`Rolled initiative for ${monsters.length} monster${monsters.length === 1 ? '' : 's'}`)
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
    <div className="xl:grid xl:h-[calc(100dvh-52px)] xl:grid-cols-[minmax(0,1fr)_minmax(340px,380px)] xl:grid-rows-[auto_minmax(0,1fr)]">
      {/* ── Turn: round, who's acting, the one button that matters ── */}
      <section
        aria-label="Turn"
        className="sticky top-[52px] z-30 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-panel p-4 xl:static xl:col-start-2 xl:row-start-1 xl:block xl:space-y-3 xl:border-l"
      >
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <RoundBox round={encounter.round} />
          <div className="min-w-0 flex-1 pt-1" aria-live="polite">
            {active ? (
              <p className="display line-clamp-2 text-xl leading-[1.15] text-vellum">
                <span className="sr-only">Now acting: </span>
                {active.name}
              </p>
            ) : (
              <p className="cmd pt-1 text-lg text-ink">{ordered.length ? 'Combat hasn’t started' : 'No combatants yet'}</p>
            )}
            {next && (
              <p className="hint mt-1.5 truncate">
                {started ? 'Then' : 'First up'} {next.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex w-full items-center gap-1.5 sm:w-auto xl:w-full">
          {started ? (
            <>
              <Button onClick={() => step(-1)} aria-keyshortcuts="Shift+Space ArrowLeft" aria-label="Previous turn" className="px-3">
                <ChevronLeft />
              </Button>
              <Button variant="primary" onClick={() => step(1)} aria-keyshortcuts="Space ArrowRight" className="flex-1 sm:min-w-44">
                Next turn <ChevronRight />
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => step(1)} disabled={!ordered.length} aria-keyshortcuts="Space" className="flex-1 sm:min-w-44">
              <Swords /> Start combat
            </Button>
          )}
          <IconButton label="Roll initiative for all monsters (I)" onClick={rollMonsters} disabled={!ordered.length}>
            <Dices />
          </IconButton>
          {started && (
            <IconButton label="Reset combat" onClick={() => setConfirmReset(true)}>
              <RotateCcw />
            </IconButton>
          )}
          <IconButton label="Keyboard shortcuts (?)" onClick={() => setShowShortcuts(true)} className="hidden sm:inline-flex">
            <Keyboard />
          </IconButton>
        </div>
      </section>

      {/* ── The stage and the cascade ─────────────────────────────── */}
      <div className="relative isolate min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
        {encounter.background_url && (
          <img src={encounter.background_url} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-20 mix-blend-luminosity" />
        )}
        <Board count={ordered.length + 1} className="[--pad-bottom:40px] [--pad-top:32px] [--stage-top:26cqw] lg:h-[max(560px,calc(100dvh-228px))] xl:h-full xl:[--stage-top:24cqw]">
          <TurnStage
            creature={active}
            direction={direction}
            caption={(c) => <StageCaption creature={c} turnLabel="Acting now" />}
            idle={<StageIdle empty={ordered.length === 0} />}
          />
          <Cascade aria-label="Initiative order">
            {ordered.map((c, i) => (
              <InitiativeRow
                key={c.id}
                index={i}
                creature={c}
                active={c.id === active?.id}
                selected={c.id === selected?.id}
                isNext={c.id === next?.id}
                onSelect={() => setSelectedId(c.id)}
                onInitiative={(initiative) => actions.updateCreature(c.id, { initiative })}
                onHp={() => setHpTarget({ id: c.id, mode: 'damage' })}
                onConditions={() => setConditionsId(c.id)}
              />
            ))}
            <CascadeRow index={ordered.length} className="flex items-center">
              <Button variant="ghost" onClick={() => setFormTarget({ mode: 'add' })} aria-keyshortcuts="A" className="ml-1">
                <Plus /> Add creature
              </Button>
            </CascadeRow>
          </Cascade>
        </Board>
      </div>

      {/* ── Command column ────────────────────────────────────────── */}
      <aside className="flex flex-col border-t border-line bg-panel lg:grid lg:grid-cols-2 lg:items-start xl:col-start-2 xl:row-start-2 xl:flex xl:items-stretch xl:overflow-y-auto xl:border-t-0 xl:border-l">
        <SpotlightCard
          creature={selected}
          isActive={selected !== null && selected.id === active?.id}
          onDamage={() => selected && setHpTarget({ id: selected.id, mode: 'damage' })}
          onHeal={() => selected && setHpTarget({ id: selected.id, mode: 'heal' })}
          onConditions={() => selected && setConditionsId(selected.id)}
          onEdit={() => selected && setFormTarget({ mode: 'edit', creature: selected })}
          onRemove={() => selected && setRemoveTarget(selected)}
        />
        <DicePanel inputRef={diceInput} />
        <p className="mt-auto hidden border-t border-line px-4 py-3 text-xs leading-6 text-ink-faint lg:col-span-2 lg:block">
          <Kbd>Space</Kbd> next turn, <Kbd>J</Kbd> <Kbd>K</Kbd> select, <Kbd>D</Kbd> damage, <Kbd>H</Kbd> heal, <Kbd>C</Kbd> conditions,{' '}
          <Kbd>?</Kbd> everything else
        </p>
      </aside>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <HpDialog
        creature={byId(hpTarget?.id)}
        initialMode={hpTarget?.mode ?? 'damage'}
        onClose={() => setHpTarget(null)}
        onApply={applyHp}
      />
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
      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name ?? ''}?`}
        body="They’ll be taken out of the initiative order. If it’s their turn, play passes to the next creature."
        confirmLabel="Remove"
        onConfirm={() => {
          if (removeTarget) actions.removeCreature(removeTarget.id)
          setRemoveTarget(null)
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset combat?"
        body="Goes back to round 1 with no one acting. HP and conditions are kept."
        confirmLabel="Reset"
        onConfirm={() => {
          actions.updateEncounter({ round: 1, active_creature_id: null })
          setConfirmReset(false)
        }}
      />
      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  )
}

/** The stage before anyone acts. */
function StageIdle({ empty }: { empty: boolean }) {
  return (
    <div className="hatch absolute inset-0 flex flex-col justify-end gap-4 bg-raised pr-[14%] pb-[calc(var(--slant)*100cqw+12px)] pl-5 lg:pb-12 lg:pl-10">
      {empty ? <Users className="size-9 text-accent" /> : <Swords className="size-9 text-accent" />}
      <p className="display print text-[clamp(2.5rem,min(9cqh,6.5cqw),7rem)] leading-[1] text-vellum">
        {empty ? (
          <>
            Gather the
            <br />
            combatants
          </>
        ) : (
          <>
            Roll for
            <br />
            initiative
          </>
        )}
      </p>
      <p className="max-w-xs text-ink-muted">
        {empty ? 'Add your party and the monsters. Leave initiative blank and it’s rolled for you.' : 'Press Space or Start combat when everyone has rolled.'}
      </p>
    </div>
  )
}
