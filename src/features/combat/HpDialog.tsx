import { useState } from 'react'
import { HeartCrack, HeartPlus, ShieldPlus } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { HpBar } from '@/components/ui/display'
import { applyDamage, applyHealing, grantTempHp, type HpResult } from '@/lib/combat'
import { cn } from '@/lib/cn'
import type { Creature } from '@/lib/types'

export type HpMode = 'damage' | 'heal' | 'temp'

const MODES: { mode: HpMode; label: string; icon: typeof HeartCrack; style: string }[] = [
  { mode: 'damage', label: 'Damage', icon: HeartCrack, style: 'data-[on=true]:bg-rubric data-[on=true]:text-vellum' },
  { mode: 'heal', label: 'Heal', icon: HeartPlus, style: 'data-[on=true]:bg-accent data-[on=true]:text-accent-ink' },
  { mode: 'temp', label: 'Temp HP', icon: ShieldPlus, style: 'data-[on=true]:bg-vellum data-[on=true]:text-vellum-ink' },
]

const QUICK = [1, 2, 5, 10]

interface HpDialogProps {
  creature: Creature | null
  initialMode: HpMode
  onClose: () => void
  onApply: (creature: Creature, result: HpResult) => void
}

export function HpDialog({ creature, initialMode, onClose, onApply }: HpDialogProps) {
  return (
    <Dialog open={creature !== null} onClose={onClose} title={creature ? creature.name : ''} size="sm">
      {creature && (
        <HpForm
          // Remount per creature + mode so state starts fresh each time it opens.
          key={`${creature.id}:${initialMode}`}
          creature={creature}
          initialMode={initialMode}
          onDone={(result) => {
            onApply(creature, result)
            onClose()
          }}
        />
      )}
    </Dialog>
  )
}

function HpForm({ creature, initialMode, onDone }: { creature: Creature; initialMode: HpMode; onDone: (r: HpResult) => void }) {
  const [mode, setMode] = useState<HpMode>(initialMode)
  const [amount, setAmount] = useState('')

  const value = Number(amount)
  const valid = amount !== '' && Number.isFinite(value) && value > 0

  function submit(m: HpMode = mode, v = value) {
    const fn = m === 'damage' ? applyDamage : m === 'heal' ? applyHealing : grantTempHp
    onDone(fn(creature, v))
  }

  if (creature.current_hp === null) {
    return <p className="text-sm text-ink-muted">This creature isn’t tracking hit points. Edit it to add max HP.</p>
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) submit()
      }}
      className="space-y-5"
    >
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="hint">hit points</span>
          <span className="tabular text-sm">
            <span className="display text-2xl text-vellum">{creature.current_hp}</span>
            <span className="text-ink-faint"> / {creature.max_hp}</span>
            {creature.temp_hp > 0 && <span className="ml-1.5 text-vellum">+{creature.temp_hp}</span>}
          </span>
        </div>
        <HpBar current={creature.current_hp} max={creature.max_hp} temp={creature.temp_hp} thick />
      </div>

      <div role="radiogroup" aria-label="Change type" className="grid grid-cols-3 border border-line">
        {MODES.map(({ mode: m, label, icon: Icon, style }) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            data-on={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              'cmd flex h-10 items-center justify-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink',
              style,
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <input
        data-autofocus
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label="Amount"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="tabular display h-24 w-full border border-line bg-canvas text-center text-5xl text-vellum placeholder:text-ink-faint/40 focus:border-accent focus:shadow-[inset_0_-3px_0_var(--color-accent)] focus:outline-none"
      />

      <div className="flex gap-1.5">
        {QUICK.map((q) => (
          <Button key={q} size="sm" className="flex-1" onClick={() => submit(mode, q)}>
            {mode === 'damage' ? '−' : '+'}
            {q}
          </Button>
        ))}
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!valid}>
        Apply {valid ? value : ''} {MODES.find((m) => m.mode === mode)!.label.toLowerCase()}
      </Button>
    </form>
  )
}
