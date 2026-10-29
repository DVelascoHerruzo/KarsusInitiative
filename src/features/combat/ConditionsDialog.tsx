import { useState } from 'react'
import { Infinity as InfinityIcon, Minus, Plus, X } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button, IconButton } from '@/components/ui/Button'
import { inputClass } from '@/components/ui/Field'
import { ConditionChip } from '@/components/ui/display'
import { CONDITIONS, conditionDef, customConditionKey, withCondition, withoutCondition } from '@/lib/conditions'
import { cn } from '@/lib/cn'
import type { Condition, Creature } from '@/lib/types'

interface ConditionsDialogProps {
  creature: Creature | null
  onClose: () => void
  onChange: (creature: Creature, conditions: Condition[]) => void
}

/** Toggles apply immediately, so the DM can tap several conditions and close. */
export function ConditionsDialog({ creature, onClose, onChange }: ConditionsDialogProps) {
  return (
    <Dialog
      open={creature !== null}
      onClose={onClose}
      title={creature ? `Conditions for ${creature.name}` : ''}
      description="Timed conditions count down at the end of this creature’s turn."
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {creature && <ConditionsEditor creature={creature} onChange={(c) => onChange(creature, c)} />}
    </Dialog>
  )
}

function ConditionsEditor({ creature, onChange }: { creature: Creature; onChange: (c: Condition[]) => void }) {
  const active = new Map(creature.conditions.map((c) => [c.key, c]))
  const custom = creature.conditions.filter((c) => c.key.startsWith('custom:'))
  const [label, setLabel] = useState('')
  const [rounds, setRounds] = useState<number | null>(10)

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {CONDITIONS.map((def) => {
          const current = active.get(def.key)
          return (
            <li key={def.key}>
              <div
                className={cn(
                  'flex h-11 items-center border transition-colors',
                  current ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-canvas hover:border-ink-faint',
                )}
              >
                <button
                  type="button"
                  aria-pressed={Boolean(current)}
                  title={def.summary}
                  onClick={() =>
                    onChange(
                      current
                        ? withoutCondition(creature.conditions, def.key)
                        : withCondition(creature.conditions, { key: def.key, rounds: null }),
                    )
                  }
                  className={cn('cmd h-full min-w-0 flex-1 truncate px-3 text-left text-sm', current ? 'text-accent-ink' : 'text-ink-muted')}
                >
                  {def.label}
                </button>
                {current && (
                  <RoundsStepper
                    onAccent
                    value={current.rounds}
                    onChange={(r) => onChange(withCondition(creature.conditions, { ...current, rounds: r }))}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <section aria-labelledby="custom-effects" className="space-y-3">
        <h3 id="custom-effects" className="cmd text-sm text-ink-muted">
          Spell effects &amp; custom tags
        </h3>
        {custom.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {custom.map((c) => (
              <li key={c.key} className="flex items-center gap-0.5">
                <ConditionChip condition={c} size="md" />
                <IconButton
                  label={`Remove ${conditionDef(c).label}`}
                  size="icon-sm"
                  onClick={() => onChange(withoutCondition(creature.conditions, c.key))}
                >
                  <X />
                </IconButton>
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
            className={cn(inputClass, 'w-auto min-w-40 flex-1')}
          />
          <div className="flex h-10 items-center border border-line bg-canvas">
            <RoundsStepper value={rounds} onChange={setRounds} />
          </div>
          <Button type="submit" disabled={!label.trim()}>
            Add
          </Button>
        </form>
      </section>
    </div>
  )
}

/** null means "until removed"; stepping below 1 returns to it. */
function RoundsStepper({ value, onChange, onAccent }: { value: number | null; onChange: (v: number | null) => void; onAccent?: boolean }) {
  const btn = cn('flex size-8 items-center justify-center', onAccent ? 'text-accent-ink/70 hover:text-accent-ink' : 'text-ink-faint hover:text-ink')
  const step = (d: number) => {
    const next = (value ?? 0) + d
    onChange(next < 1 ? null : Math.min(99, next))
  }
  return (
    <div className={cn('flex shrink-0 items-center', onAccent && 'text-accent-ink')} role="group" aria-label="Duration in rounds">
      <button type="button" aria-label="Fewer rounds" onClick={() => step(-1)} className={btn}>
        <Minus className="size-3.5" />
      </button>
      <span className="tabular w-6 text-center text-sm" aria-live="polite">
        {value ?? <InfinityIcon className="mx-auto size-3.5 opacity-60" aria-label="Until removed" />}
      </span>
      <button type="button" aria-label="More rounds" onClick={() => step(1)} className={btn}>
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}
