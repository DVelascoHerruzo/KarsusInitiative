import { useState } from 'react'
import { Infinity as InfinityIcon, Minus, Plus } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { StatusPill, pillColor } from '@/components/ui/tokens'
import { CONDITIONS, customConditionKey, withCondition, withoutCondition } from '@/lib/conditions'
import { cn } from '@/lib/cn'
import type { Condition, Creature } from '@/lib/types'

type ConditionsTarget = Pick<Creature, 'id' | 'name' | 'conditions'>

interface ConditionsDialogProps<T extends ConditionsTarget> {
  creature: T | null
  onClose: () => void
  onChange: (creature: T, conditions: Condition[]) => void
}

/** Toggles apply immediately, so the DM can tap several conditions and close. */
export function ConditionsDialog<T extends ConditionsTarget>({ creature, onClose, onChange }: ConditionsDialogProps<T>) {
  return (
    <Modal
      open={creature !== null}
      onClose={onClose}
      title={creature ? `Conditions for ${creature.name}` : ''}
      description="Timed conditions count down at the end of this creature’s turn."
      size="lg"
    >
      {creature && <ConditionsEditor creature={creature} onChange={(c) => onChange(creature, c)} />}
      <div className="flex justify-end border-t border-dnd-border px-6 py-4">
        <button type="button" className="dnd-button-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  )
}

function ConditionsEditor({ creature, onChange }: { creature: ConditionsTarget; onChange: (c: Condition[]) => void }) {
  const active = new Map(creature.conditions.map((c) => [c.key, c]))
  const custom = creature.conditions.filter((c) => c.key.startsWith('custom:'))
  const [label, setLabel] = useState('')
  const [rounds, setRounds] = useState<number | null>(10)

  return (
    <div className="space-y-6 p-6">
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {CONDITIONS.map((def) => {
          const current = active.get(def.key)
          return (
            <li key={def.key}>
              <div className={cn('flex h-10 items-center rounded-lg border transition-colors', current ? pillColor(def.key) : 'border-dnd-border/60 bg-dnd-dark/60')}>
                <button
                  type="button"
                  aria-pressed={Boolean(current)}
                  title={def.summary}
                  onClick={() =>
                    onChange(current ? withoutCondition(creature.conditions, def.key) : withCondition(creature.conditions, { key: def.key, rounds: null }))
                  }
                  className={cn('h-full min-w-0 flex-1 truncate px-3 text-left font-ui text-sm', current ? '' : 'text-dnd-muted hover:text-dnd-parchment')}
                >
                  {def.label}
                </button>
                {current && <RoundsStepper value={current.rounds} onChange={(r) => onChange(withCondition(creature.conditions, { ...current, rounds: r }))} />}
              </div>
            </li>
          )
        })}
      </ul>

      <section aria-labelledby="custom-effects" className="space-y-3">
        <h3 id="custom-effects" className="dnd-label">
          Spell effects &amp; custom tags
        </h3>
        {custom.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {custom.map((c) => (
              <li key={c.key}>
                <StatusPill condition={c} size="md" onRemove={() => onChange(withoutCondition(creature.conditions, c.key))} />
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const text = label.trim()
            if (!text) return
            onChange(withCondition(creature.conditions, { key: customConditionKey(text), label: text, rounds }))
            setLabel('')
          }}
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 40))}
            placeholder="Bless, Hex, Hunter’s Mark…"
            aria-label="Custom effect name"
            className="dnd-input w-auto min-w-40 flex-1"
          />
          <div className="flex h-11 items-center rounded-lg border border-dnd-border bg-dnd-dark/80">
            <RoundsStepper value={rounds} onChange={setRounds} />
          </div>
          <button type="submit" className="dnd-button-secondary" disabled={!label.trim()}>
            Add
          </button>
        </form>
      </section>
    </div>
  )
}

/** null means "until removed"; stepping below 1 returns to it. */
function RoundsStepper({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const step = (d: number) => {
    const next = (value ?? 0) + d
    onChange(next < 1 ? null : Math.min(99, next))
  }
  const btn = 'flex h-8 w-7 items-center justify-center opacity-70 hover:opacity-100'
  return (
    <div className="flex shrink-0 items-center" role="group" aria-label="Duration in rounds">
      <button type="button" aria-label="Fewer rounds" onClick={() => step(-1)} className={btn}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-6 text-center text-sm" aria-live="polite">
        {value ?? <InfinityIcon className="mx-auto h-3.5 w-3.5 opacity-60" aria-label="Until removed" />}
      </span>
      <button type="button" aria-label="More rounds" onClick={() => step(1)} className={btn}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
