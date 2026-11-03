import type { ComponentProps } from 'react'
import { Sword, User, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { conditionDef } from '@/lib/conditions'
import { HEALTH_LABEL } from '@/lib/combat'
import type { Condition, HealthBand } from '@/lib/types'

// The small pieces every screen shares: round creature tokens with their
// initiative badge, HP bars, and condition pills.

interface TokenProps {
  name: string
  src: string | null
  isPlayer?: boolean
  /** Pixel size of the circle. */
  size?: number
  active?: boolean
  dead?: boolean
  /** Shown as a badge on the bottom right. */
  initiative?: number
  className?: string
}

export function Token({ name, src, isPlayer, size = 40, active, dead, initiative, className }: TokenProps) {
  const icon = Math.round(size * 0.45)
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt=""
          className={cn('h-full w-full rounded-full border-2 object-cover', active ? 'border-dnd-gold' : 'border-dnd-border/60', dead && 'grayscale')}
        />
      ) : (
        <div className={cn('flex h-full w-full items-center justify-center rounded-full border-2 bg-dnd-surface', active ? 'border-dnd-gold' : 'border-dnd-border/60')}>
          {isPlayer ? (
            <User style={{ width: icon, height: icon }} className={active ? 'text-dnd-gold' : 'text-dnd-gold/80'} />
          ) : (
            <Sword style={{ width: icon, height: icon }} className={active ? 'text-dnd-gold' : 'text-dnd-muted'} />
          )}
        </div>
      )}
      <span className="sr-only">{name}</span>
      {initiative !== undefined && (
        <span
          className={cn(
            'absolute -right-1 -bottom-1 flex min-w-5 items-center justify-center rounded-full border px-1 text-[10px] leading-5 font-bold',
            active ? 'border-dnd-gold bg-dnd-gold text-black' : 'border-dnd-dark bg-dnd-crimson text-white',
          )}
        >
          {initiative}
        </span>
      )}
    </div>
  )
}

/** Green, then yellow, then red as HP drops. Temporary HP shows as a pale band at the end. */
export function HpBar({ current, max, temp = 0, className }: { current: number | null; max: number | null; temp?: number; className?: string }) {
  if (current === null || max === null || max <= 0) return null
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const tempPct = Math.min(100 - pct, (temp / max) * 100)
  return (
    <div className={cn('flex h-1.5 w-full overflow-hidden rounded-full bg-dnd-dark', className)} aria-hidden>
      <div
        className={cn('h-full transition-all duration-500', pct > 60 ? 'bg-emerald-500' : pct > 30 ? 'bg-yellow-500' : 'bg-red-500')}
        style={{ width: `${pct}%` }}
      />
      {tempPct > 0 && <div className="h-full bg-sky-300/80" style={{ width: `${tempPct}%` }} />}
    </div>
  )
}

/** One colour per condition, as on the old board. Custom effects share the arcane purple. */
const PILL: Record<string, string> = {
  dead: 'bg-gray-800/60 text-gray-300 border-gray-600/50',
  unconscious: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50',
  concentrating: 'bg-sky-900/50 text-sky-300 border-sky-700/50',
  poisoned: 'bg-lime-900/50 text-lime-300 border-lime-600/50',
  stunned: 'bg-orange-900/50 text-orange-300 border-orange-700/50',
  incapacitated: 'bg-red-900/50 text-red-300 border-red-700/50',
  charmed: 'bg-pink-900/50 text-pink-300 border-pink-600/50',
  frightened: 'bg-violet-900/50 text-violet-300 border-violet-700/50',
  paralyzed: 'bg-amber-900/50 text-amber-200 border-amber-600/50',
  petrified: 'bg-stone-700/50 text-stone-300 border-stone-500/50',
  blinded: 'bg-neutral-800/60 text-neutral-300 border-neutral-600/50',
  deafened: 'bg-slate-800/50 text-slate-300 border-slate-600/50',
  invisible: 'bg-cyan-900/50 text-cyan-300 border-cyan-700/50',
  prone: 'bg-amber-800/50 text-amber-300 border-amber-600/50',
  restrained: 'bg-rose-900/50 text-rose-300 border-rose-700/50',
  grappled: 'bg-orange-950/50 text-orange-200 border-orange-800/50',
  exhaustion: 'bg-indigo-900/50 text-indigo-300 border-indigo-700/50',
}
export const pillColor = (key: string) => PILL[key] ?? 'bg-purple-900/40 text-purple-200 border-purple-600/50'

interface StatusPillProps extends Omit<ComponentProps<'span'>, 'children'> {
  condition: Condition
  onRemove?: () => void
  size?: 'sm' | 'md'
}

export function StatusPill({ condition, onRemove, size = 'sm', className, ...props }: StatusPillProps) {
  const def = conditionDef(condition)
  return (
    <span
      title={def.summary}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded border leading-tight',
        size === 'sm' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-sm',
        pillColor(condition.key),
        className,
      )}
      {...props}
    >
      {def.label}
      {condition.rounds !== null && <span className="opacity-70">{condition.rounds}r</span>}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${def.label}`} className="opacity-60 transition-opacity hover:opacity-100">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}

const HEALTH_COLOR: Record<HealthBand, string> = {
  healthy: 'text-emerald-400 border-emerald-700/50 bg-emerald-900/30',
  wounded: 'text-lime-300 border-lime-700/50 bg-lime-900/30',
  bloodied: 'text-yellow-300 border-yellow-700/50 bg-yellow-900/30',
  critical: 'text-red-300 border-red-700/50 bg-red-900/30',
  down: 'text-gray-400 border-gray-700/50 bg-gray-900/30',
}

/** How hurt a monster looks, for screens that mustn't show its HP. */
export function HealthTag({ band, className }: { band: HealthBand; className?: string }) {
  return <span className={cn('rounded border px-1.5 py-0.5 text-[11px]', HEALTH_COLOR[band], className)}>{HEALTH_LABEL[band]}</span>
}

export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status">
      <div className="flex flex-col items-center gap-4">
        <svg className="h-16 w-16 animate-spin text-dnd-jade" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="font-body text-lg tracking-widest text-dnd-jade">{label}</p>
      </div>
    </div>
  )
}

interface NumberInputProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  value: number | null
  onValueChange: (value: number | null) => void
}

/** Number input that tracks null for "empty" instead of NaN or 0. */
export function NumberInput({ value, onValueChange, className, ...props }: NumberInputProps) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={cn('dnd-input', className)}
      value={value ?? ''}
      onChange={(e) => onValueChange(e.target.value === '' ? null : Math.trunc(Number(e.target.value)))}
      {...props}
    />
  )
}
