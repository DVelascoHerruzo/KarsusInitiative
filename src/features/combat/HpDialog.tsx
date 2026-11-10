import { useState } from 'react'
import { Heart, HeartCrack, HeartPlus, ShieldPlus } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { HpBar } from '@/components/ui/tokens'
import { applyDamage, applyHealing, grantTempHp, type HpResult } from '@/lib/combat'
import { cn } from '@/lib/cn'
import type { Creature } from '@/lib/types'

export type HpMode = 'damage' | 'heal' | 'temp'

const MODES: { mode: HpMode; label: string; icon: typeof HeartCrack; on: string }[] = [
  { mode: 'damage', label: 'Damage', icon: HeartCrack, on: 'bg-dnd-crimson text-white border-dnd-crimson' },
  { mode: 'heal', label: 'Heal', icon: HeartPlus, on: 'bg-emerald-700 text-white border-emerald-600' },
  { mode: 'temp', label: 'Temp HP', icon: ShieldPlus, on: 'bg-sky-700 text-white border-sky-600' },
]

const QUICK = [1, 2, 5, 10]

/** The fields the dialog reads, so the player view's creatures work as well as the DM's. */
type HpTarget = Pick<Creature, 'id' | 'name' | 'is_player' | 'current_hp' | 'max_hp' | 'temp_hp' | 'conditions'>

interface HpDialogProps<T extends HpTarget> {
  creature: T | null
  initialMode: HpMode
  onClose: () => void
  onApply: (creature: T, result: HpResult) => void
}

export function HpDialog<T extends HpTarget>({ creature, initialMode, onClose, onApply }: HpDialogProps<T>) {
  return (
    <Modal open={creature !== null} onClose={onClose} title={creature?.name ?? ''} size="sm">
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
    </Modal>
  )
}

function HpForm({ creature, initialMode, onDone }: { creature: HpTarget; initialMode: HpMode; onDone: (r: HpResult) => void }) {
  const [mode, setMode] = useState<HpMode>(initialMode)
  const [amount, setAmount] = useState('')

  const value = Number(amount)
  const valid = amount !== '' && Number.isFinite(value) && value > 0

  function submit(m: HpMode = mode, v = value) {
    const fn = m === 'damage' ? applyDamage : m === 'heal' ? applyHealing : grantTempHp
    onDone(fn(creature, v))
  }

  if (creature.current_hp === null) {
    return <p className="p-6 font-ui text-dnd-muted italic">This creature isn’t tracking hit points. Edit it to add max HP.</p>
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) submit()
      }}
      className="space-y-5 p-6"
    >
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-body text-xs tracking-widest text-dnd-muted uppercase">
            <Heart className="h-3.5 w-3.5 text-red-400" /> Hit points
          </span>
          <span className="font-body">
            <span className="font-display text-2xl text-dnd-parchment">{creature.current_hp}</span>
            <span className="text-dnd-muted"> / {creature.max_hp}</span>
            {creature.temp_hp > 0 && <span className="ml-1.5 text-sky-300">+{creature.temp_hp}</span>}
          </span>
        </div>
        <HpBar current={creature.current_hp} max={creature.max_hp} temp={creature.temp_hp} className="h-2" />
      </div>

      <div role="radiogroup" aria-label="Change type" className="grid grid-cols-3 gap-1.5">
        {MODES.map(({ mode: m, label, icon: Icon, on }) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              'flex h-10 items-center justify-center gap-1.5 rounded-lg border font-body text-xs tracking-wider transition-colors',
              mode === m ? on : 'border-dnd-border text-dnd-muted hover:text-dnd-parchment',
            )}
          >
            <Icon className="h-4 w-4" /> {label}
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
        className="dnd-input h-20 text-center font-display text-4xl"
      />

      <div className="flex gap-1.5">
        {QUICK.map((q) => (
          <button key={q} type="button" className="dnd-button-secondary flex-1 px-0 py-1.5 text-sm" onClick={() => submit(mode, q)}>
            {mode === 'damage' ? '−' : '+'}
            {q}
          </button>
        ))}
      </div>

      <button type="submit" className="dnd-button-primary w-full" disabled={!valid}>
        Apply {valid ? value : ''} {MODES.find((m) => m.mode === mode)!.label.toLowerCase()}
      </button>
    </form>
  )
}
