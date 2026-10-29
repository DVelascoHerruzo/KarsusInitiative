import { useRef, useState } from 'react'
import { ConditionChip, HpBar } from '@/components/ui/display'
import { hasCondition } from '@/lib/conditions'
import { cn } from '@/lib/cn'
import type { Creature } from '@/lib/types'
import { CascadeRow, SelectWedge, TurnWedge } from './Cascade'

interface InitiativeRowProps {
  creature: Creature
  index: number
  active: boolean
  selected: boolean
  isNext: boolean
  onSelect: () => void
  onInitiative: (value: number) => void
  onHp: () => void
  onConditions: () => void
}

/**
 * One creature in the DM's cascade: the name on the slope, its conditions on a
 * fixed line beneath (click them to edit), and HP on the right. Edit and remove
 * live in the selected-creature panel, so long names keep the room.
 */
export function InitiativeRow({ creature: c, index, active, selected, isNext, onSelect, onInitiative, onHp, onConditions }: InitiativeRowProps) {
  const dead = hasCondition(c.conditions, 'dead')
  const visible = c.conditions.filter((x) => x.key !== 'dead')

  return (
    <CascadeRow
      index={index}
      onClick={onSelect}
      aria-current={active ? 'step' : undefined}
      className={cn('group flex cursor-pointer items-center gap-3 pr-3 lg:gap-4 lg:pr-5', dead && 'opacity-45')}
    >
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-[calc(var(--row-h)*0.04)] text-[calc(var(--row-h)*0.31)] sm:text-[calc(var(--row-h)*0.34)] lg:text-[calc(var(--row-h)*0.38)]">
        <span className={cn('relative isolate flex h-[1.4em] max-w-full min-w-0 items-center gap-[0.4em] self-start pl-[0.35em]', active ? 'pr-[1.3em]' : 'pr-[0.5em]')}>
          {active && <TurnWedge />}
          {selected && !active && <SelectWedge />}
          <InitiativeInput name={c.name} value={c.initiative} active={active} onCommit={onInitiative} />
          <span
            className={cn(
              'display truncate pr-[0.1em] leading-[1.3]',
              active ? 'text-rubric' : 'text-ink group-hover:text-vellum',
              dead && 'line-through decoration-[0.06em]',
            )}
          >
            {c.name}
          </span>
          {c.is_player && (
            <span className={cn('cmd shrink-0 text-xs', active ? 'text-vellum-muted' : 'text-ink-faint')} title="Player character">
              PC
            </span>
          )}
        </span>

        <span className="flex h-5 min-w-0 items-center gap-2 pl-[1.75em]">
          {isNext && !active && <span className="hint shrink-0">next</span>}
          <button
            type="button"
            aria-label={`Conditions for ${c.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onConditions()
            }}
            className="flex h-full min-w-0 items-center gap-1 overflow-hidden focus-visible:outline-offset-1"
          >
            {visible.map((x) => (
              <ConditionChip key={x.key} condition={x} />
            ))}
            <span
              className={cn(
                'cmd shrink-0 px-1 text-xs text-ink-faint transition-opacity hover:text-accent',
                visible.length > 0 || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
            >
              {visible.length > 0 ? 'Edit' : 'Add condition'}
            </span>
          </button>
        </span>
      </span>

      {c.max_hp !== null ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onHp()
          }}
          aria-label={`${c.name}: ${c.current_hp} of ${c.max_hp} hit points. Change HP`}
          className="w-[4.5rem] shrink-0 px-1.5 py-1.5 text-left transition-colors hover:bg-raised sm:w-32 sm:px-2"
        >
          <span className="tabular cmd mb-1 flex items-baseline justify-between text-xs">
            <span>
              <span className="text-sm text-ink">{c.current_hp}</span>
              <span className="text-ink-faint">/{c.max_hp}</span>
            </span>
            {c.temp_hp > 0 && <span className="text-vellum">+{c.temp_hp}</span>}
          </span>
          <HpBar current={c.current_hp} max={c.max_hp} temp={c.temp_hp} />
        </button>
      ) : (
        <span className="w-[4.5rem] shrink-0 sm:w-32" />
      )}
    </CascadeRow>
  )
}

/** Looks like a numeral, edits like an input: players call out rolls and the DM types them straight in. */
function InitiativeInput({ name, value, active, onCommit }: { name: string; value: number; active: boolean; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)

  return (
    <input
      aria-label={`Initiative for ${name}`}
      inputMode="numeric"
      value={draft ?? String(value)}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => {
        cancelled.current = false
        setDraft(String(value))
        e.target.select()
      }}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d-]/g, '').slice(0, 3))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
      onBlur={() => {
        const n = Number(draft)
        if (!cancelled.current && draft !== null && draft !== '' && Number.isInteger(n) && n !== value) onCommit(n)
        setDraft(null)
      }}
      className={cn(
        'figure h-[1.15em] w-[1.6em] shrink-0 border bg-transparent text-center text-[0.6em] transition-colors',
        'focus:border-accent focus:bg-canvas focus:text-ink focus:outline-none',
        active ? 'border-vellum-ink/25 text-vellum-ink' : 'border-transparent text-ink-faint hover:border-line',
      )}
    />
  )
}
