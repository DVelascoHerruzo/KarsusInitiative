import { useRef, useState, type Ref } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Dices, Trash2 } from 'lucide-react'
import { DiceSyntaxError, rollDice, type RollResult } from '@/lib/dice'
import { cn } from '@/lib/cn'

const QUICK = [4, 6, 8, 10, 12, 20, 100] as const
type Mode = 'normal' | 'advantage' | 'disadvantage'

interface LoggedRoll extends RollResult {
  id: number
  label?: string
}

let nextId = 1

export function DicePanel({ inputRef, className }: { inputRef?: Ref<HTMLInputElement>; className?: string }) {
  const [notation, setNotation] = useState('')
  const [mode, setMode] = useState<Mode>('normal')
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<LoggedRoll[]>([])
  const live = useRef<HTMLParagraphElement>(null)

  function roll(text: string, label?: string) {
    try {
      const result = rollDice(text)
      setLog((l) => [{ ...result, id: nextId++, label }, ...l].slice(0, 30))
      setError(null)
      if (live.current) live.current.textContent = `${label ?? result.notation}: ${result.total}`
    } catch (e) {
      setError(e instanceof DiceSyntaxError ? e.message : 'Couldn’t roll that')
    }
  }

  function quick(sides: number) {
    if (sides === 20 && mode !== 'normal') roll(mode === 'advantage' ? '2d20kh1' : '2d20kl1', `d20 ${mode}`)
    else roll(`1d${sides}`)
  }

  return (
    <section aria-labelledby="dice-heading" className={cn('dnd-card p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 id="dice-heading" className="flex items-center gap-2 font-body text-sm tracking-widest text-dnd-parchment uppercase">
          <Dices className="h-4 w-4 text-dnd-jade" /> Dice
        </h2>
        {log.length > 0 && (
          <button type="button" onClick={() => setLog([])} aria-label="Clear roll history" className="dnd-button-ghost px-2 py-1 text-xs">
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (notation.trim()) roll(notation)
        }}
      >
        <input
          ref={inputRef}
          value={notation}
          onChange={(e) => {
            setNotation(e.target.value)
            setError(null)
          }}
          placeholder="2d6+3, 4d6kh3…"
          aria-label="Dice notation"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'dice-error' : undefined}
          className="dnd-input min-w-0 flex-1 py-2"
        />
        <button type="submit" className="dnd-button-secondary px-4 py-2" disabled={!notation.trim()} title="Roll any dice: 2d6+3, 4d6kh3 (keep highest 3), 2d20kl1 (disadvantage)…">
          Roll
        </button>
      </form>
      {error && (
        <p id="dice-error" className="mt-1 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="mt-3 grid grid-cols-7 gap-1">
        {QUICK.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => quick(s)}
            title={s === 20 ? 'Roll a d20, with advantage or disadvantage if chosen below' : `Roll one d${s}`}
            className={cn(
              'h-9 rounded-md border border-dnd-border/60 bg-dnd-dark/60 font-body text-xs transition-colors hover:border-dnd-jade hover:text-dnd-jade',
              s === 20 && mode !== 'normal' ? 'text-dnd-gold' : 'text-dnd-muted',
            )}
          >
            d{s}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label="d20 mode" className="mt-2 grid grid-cols-3 gap-1">
        {(['disadvantage', 'normal', 'advantage'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            title={m === 'normal' ? 'The d20 button rolls once' : m === 'advantage' ? 'The d20 button rolls two and keeps the higher' : 'The d20 button rolls two and keeps the lower'}
            className={cn(
              'h-8 rounded-md font-body text-[11px] tracking-wider capitalize transition-colors',
              mode === m ? 'bg-dnd-teal text-white' : 'text-dnd-muted hover:text-dnd-parchment',
            )}
          >
            {m === 'normal' ? 'Straight' : m}
          </button>
        ))}
      </div>

      <p ref={live} className="sr-only" aria-live="polite" />

      <ol className="mt-3 max-h-64 space-y-1 overflow-y-auto" aria-label="Roll history">
        <AnimatePresence initial={false}>
          {log.map((r) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 rounded-lg border border-dnd-border/40 bg-dnd-dark/60 px-3 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-xs text-dnd-muted">{r.label ?? r.notation}</p>
                <p className="truncate text-xs text-dnd-muted/70">
                  {r.terms.map((t, i) =>
                    t.term.kind === 'flat' ? (
                      <span key={i}>
                        {' '}
                        {t.term.sign < 0 ? '−' : '+'} {t.term.value}
                      </span>
                    ) : (
                      <span key={i}>
                        {i > 0 && (t.term.sign < 0 ? ' − ' : ' + ')}[
                        {t.rolls.map((v, j) => (
                          <span key={j} className={cn(!t.kept[j] && 'line-through opacity-50')}>
                            {j > 0 && ', '}
                            {v}
                          </span>
                        ))}
                        ]
                      </span>
                    ),
                  )}
                </p>
              </div>
              <span className={cn('font-display text-2xl', r.natural === 20 ? 'text-dnd-amber' : r.natural === 1 ? 'text-dnd-red' : 'text-dnd-parchment')}>
                {r.total}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
        {log.length === 0 && <li className="py-2 text-center font-ui text-xs text-dnd-muted italic">Rolls stay on this device.</li>}
      </ol>
    </section>
  )
}
