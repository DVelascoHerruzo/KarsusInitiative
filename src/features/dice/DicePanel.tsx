import { useRef, useState, type Ref } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { inputClass } from '@/components/ui/Field'
import { Panel, PanelAction, PanelHeader } from '@/components/ui/Panel'
import { Kbd } from '@/components/ui/display'
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
    <Panel aria-labelledby="dice-heading" className={className}>
      <PanelHeader
        id="dice-heading"
        title="Dice"
        meta={<Kbd>R</Kbd>}
        actions={
          log.length > 0 && (
            <PanelAction onClick={() => setLog([])} aria-label="Clear roll history">
              <Trash2 /> Clear
            </PanelAction>
          )
        }
      />

      <div className="space-y-3 p-4">
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
            className={cn(inputClass, 'tabular min-w-0 flex-1')}
          />
          <Button type="submit" variant="secondary" disabled={!notation.trim()}>
            Roll
          </Button>
        </form>
        {error && (
          <p id="dice-error" className="text-xs text-signal">
            {error}
          </p>
        )}

        <div className="grid grid-cols-7 gap-px bg-line p-px">
          {QUICK.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => quick(s)}
              className={cn(
                'tabular cmd h-9 bg-canvas text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink',
                s === 20 && mode !== 'normal' && 'text-accent',
              )}
            >
              d{s}
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label="d20 mode" className="grid grid-cols-3 border border-line text-sm">
          {(['disadvantage', 'normal', 'advantage'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn('cmd h-8 capitalize transition-colors', mode === m ? 'bg-accent text-accent-ink' : 'text-ink-faint hover:text-ink')}
            >
              {m === 'normal' ? 'Straight' : m}
            </button>
          ))}
        </div>
      </div>

      <p ref={live} className="sr-only" aria-live="polite" />

      <ol className="max-h-72 min-h-16 space-y-px overflow-y-auto px-4 pb-4" aria-label="Roll history">
        <AnimatePresence initial={false}>
          {log.map((r) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 bg-canvas px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="cmd truncate text-xs text-ink-muted">{r.label ?? r.notation}</p>
                <p className="tabular truncate text-xs text-ink-faint">
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
              <span className={cn('tabular display text-2xl', r.natural === 20 ? 'text-warn' : r.natural === 1 ? 'text-signal' : 'text-vellum')}>
                {r.total}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
        {log.length === 0 && <li className="hint py-3 text-center">Rolls stay on this device.</li>}
      </ol>
    </Panel>
  )
}
