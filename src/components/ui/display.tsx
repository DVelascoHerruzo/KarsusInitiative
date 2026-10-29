import type { CSSProperties, ReactNode } from 'react'
import { Skull } from 'lucide-react'
import { conditionDef, type ConditionTone } from '@/lib/conditions'
import { HEALTH_LABEL, hpFraction } from '@/lib/combat'
import { cn } from '@/lib/cn'
import type { Condition, HealthBand } from '@/lib/types'

/** tan of the system angle, for shapes whose size is known in JS. Mirrors --slant. */
export const SLANT = 0.21
export const SLANT_DEG = 11.86

// ─── Monogram plate ──────────────────────────────────────────────────────────

export function initials(name: string) {
  const words = name.replace(/\d+$/, '').trim().split(/\s+/)
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : name.trim().slice(0, 2)).toUpperCase()
}

/** Stable offset per name, so creatures without art still read as different plates. */
function nameShift(name: string) {
  let h = 0
  for (const ch of name.replace(/\s*\d+$/, '')) h = (h * 31 + ch.charCodeAt(0)) % 360
  // From steel blue through indigo and plum to wine: night tones that never drift into teal.
  return (h % 121) - 40
}

/** Plate colour for a name, as a CSS value that follows the theme's base hue. */
export function plateColor(name: string, lightness = 0.3) {
  return `oklch(${lightness} 0.06 calc(var(--hue-base) + ${nameShift(name)}))`
}

interface MonogramPlateProps {
  name: string
  className?: string
  /** Sizes the monogram; the stage passes container units, avatars pass px. */
  monogramStyle?: CSSProperties
}

/** Stand-in art for a creature without a portrait: a dark oil tone, engraving hatch and a huge cropped Bodoni initial. */
export function MonogramPlate({ name, className, monogramStyle }: MonogramPlateProps) {
  return (
    <div className={cn('hatch absolute inset-0 overflow-hidden', className)} style={{ backgroundColor: plateColor(name) }} aria-hidden>
      <span className="display absolute -bottom-[0.12em] -left-[0.04em] leading-[0.8] text-vellum/20" style={monogramStyle}>
        {initials(name)}
      </span>
    </div>
  )
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

interface AvatarProps {
  name: string
  src?: string | null
  size?: number
  dead?: boolean
  className?: string
}

/** A portrait clipped to a parallelogram on the system angle. */
export function Avatar({ name, src, size = 40, dead, className }: AvatarProps) {
  const w = Math.round(size * SLANT)
  return (
    <span
      className={cn('relative inline-block shrink-0 overflow-hidden', dead && 'grayscale', className)}
      style={{
        width: size + w,
        height: size,
        clipPath: `polygon(0 0, calc(100% - ${w}px) 0, 100% 100%, ${w}px 100%)`,
      }}
    >
      {src ? (
        <img src={src} alt="" className="absolute inset-0 size-full object-cover object-top" loading="lazy" decoding="async" />
      ) : (
        <MonogramPlate name={name} monogramStyle={{ fontSize: size * 0.95 }} />
      )}
      {dead && (
        <span className="absolute inset-0 flex items-center justify-center bg-canvas/65">
          <Skull className="text-ink-muted" style={{ width: size * 0.45, height: size * 0.45 }} aria-hidden />
        </span>
      )}
    </span>
  )
}

// ─── HP ──────────────────────────────────────────────────────────────────────

function hpFill(fraction: number) {
  if (fraction > 0.5) return 'bg-accent'
  if (fraction > 0.25) return 'bg-warn'
  return 'bg-signal'
}

interface HpBarProps {
  current: number | null
  max: number | null
  temp?: number
  className?: string
  thick?: boolean
}

/** A sheared bar, like the party gauges in a pause menu: moonlight, then gilt, then red. Temp HP rides on the end in vellum. */
export function HpBar({ current, max, temp = 0, className, thick }: HpBarProps) {
  const f = hpFraction(current, max)
  if (f === null || max === null) return null
  const tempF = Math.min(1 - f, temp / max)
  return (
    <div
      role="meter"
      aria-label="Hit points"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={current ?? 0}
      className={cn('flex bg-ink/10', thick ? 'h-2.5' : 'h-1.5', className)}
      style={{ transform: `skewX(${SLANT_DEG}deg)` }}
    >
      <div className={cn('h-full transition-[width] duration-500 ease-out', hpFill(f))} style={{ width: `${f * 100}%` }} />
      {tempF > 0 && <div className="h-full bg-vellum transition-[width] duration-500" style={{ width: `${tempF * 100}%` }} />}
    </div>
  )
}

const bandStyle: Record<HealthBand, string> = {
  healthy: 'text-accent',
  wounded: 'text-accent-soft',
  bloodied: 'text-warn',
  critical: 'text-signal',
  down: 'text-ink-faint',
}

export function HealthTag({ band, className }: { band: HealthBand; className?: string }) {
  return <span className={cn('cmd text-sm', bandStyle[band], className)}>{HEALTH_LABEL[band]}</span>
}

// ─── Conditions ──────────────────────────────────────────────────────────────

const toneStyle: Record<ConditionTone, string> = {
  danger: 'text-signal [--wedge:color-mix(in_oklab,var(--color-signal)_20%,transparent)]',
  control: 'text-warn [--wedge:color-mix(in_oklab,var(--color-warn)_16%,transparent)]',
  sense: 'text-arcane [--wedge:color-mix(in_oklab,var(--color-arcane)_20%,transparent)]',
  buff: 'text-accent [--wedge:color-mix(in_oklab,var(--color-accent)_16%,transparent)]',
  neutral: 'text-ink-muted [--wedge:color-mix(in_oklab,var(--color-ink)_10%,transparent)]',
}

interface ConditionChipProps {
  condition: Condition
  size?: 'sm' | 'md'
  className?: string
}

export function ConditionChip({ condition, size = 'sm', className }: ConditionChipProps) {
  const def = conditionDef(condition)
  return (
    <span
      title={def.summary}
      className={cn(
        'wedge cmd inline-flex items-center gap-1 whitespace-nowrap',
        size === 'sm' ? 'h-5 px-2 text-xs' : 'h-7 px-3 text-sm',
        toneStyle[def.tone],
        className,
      )}
    >
      {def.label}
      {condition.rounds !== null && (
        <span className="tabular not-italic opacity-75" aria-label={`${condition.rounds} rounds left`}>
          {condition.rounds}
        </span>
      )}
    </span>
  )
}

// ─── Misc ────────────────────────────────────────────────────────────────────

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center border border-line bg-canvas px-1 font-sans text-xs font-semibold text-ink-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/** A square turning on its corner. */
export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block size-4 animate-spin border-2 border-accent border-t-transparent', className)} aria-hidden />
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4" role="status">
      <Spinner className="size-6" />
      <span className="hint">{label}…</span>
    </div>
  )
}

/** The Karsus mark: a d20 silhouette in vellum with its top facet in rubric. */
export function Emblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <path d="M16 2 28.1 9v14L16 30 3.9 23V9Z" fill="var(--color-vellum)" />
      <path d="M16 8.5 23 20.5H9Z" fill="var(--color-rubric)" />
      <path
        d="M16 2v6.5M28.1 9 23 20.5M3.9 9 9 20.5M16 30l-7-9.5M16 30l7-9.5M3.9 23 9 20.5M28.1 23 23 20.5"
        stroke="var(--color-canvas)"
        strokeOpacity="0.45"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  )
}

interface EmptyStateProps {
  icon: ReactNode
  title: string
  body: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-start gap-3 border-l-2 border-accent bg-panel px-6 py-8', className)}>
      <span className="text-accent [&_svg]:size-7">{icon}</span>
      <h3 className="display text-2xl text-vellum">{title}</h3>
      <p className="max-w-sm text-sm text-ink-muted">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
