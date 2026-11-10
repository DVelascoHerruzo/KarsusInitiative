import { useEffect, useId, type ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { HealthTag, HpBar } from '@/components/ui/tokens'
import { FONTS, HEALTH_COLORS, TEXT_SIZES, loadClearFont, useDisplay, type HealthColors, type TextSize } from '@/lib/display'
import { cn } from '@/lib/cn'

/** An on/off switch with its label (and, on the account page, a line explaining it). */
function Toggle({ label, detail, checked, onChange }: { label: string; detail?: string; checked: boolean; onChange: (on: boolean) => void }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer font-ui text-sm text-dnd-parchment">
          {label}
        </label>
        {detail && <p className="text-xs text-dnd-muted italic">{detail}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-transparent bg-dnd-teal-strong' : 'border-dnd-border bg-dnd-dark',
        )}
      >
        <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}

/** A row of mutually exclusive buttons: real radio inputs, so arrow keys move between them. */
function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; content: ReactNode; title?: string }[]; value: T; onChange: (v: T) => void }) {
  const name = useId()
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-dnd-border bg-dnd-dark/60 p-0.5">
      {options.map((o) => (
        <label
          key={o.id}
          title={o.title}
          className={cn(
            'flex min-h-7 flex-1 cursor-pointer items-center justify-center rounded-md px-2 font-ui text-xs transition-colors has-focus-visible:outline-2 has-focus-visible:outline-dnd-jade',
            value === o.id ? 'bg-dnd-teal-strong text-white' : 'text-dnd-muted hover:text-dnd-parchment',
          )}
        >
          <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} className="sr-only" />
          {o.content}
        </label>
      ))}
    </div>
  )
}

/** "A" in three sizes: the text-size choices, drawn rather than named. */
const SIZE_GLYPH: Record<TextSize, string> = { default: 'text-xs', large: 'text-sm', larger: 'text-base' }

const CONTRAST = { label: 'High contrast', detail: 'Brighter secondary text and borders, and solid panels.' }
const CALM = { label: 'Reduce motion', detail: 'Turns, dialogs and dice change instantly instead of sliding.' }
const PLAIN = { label: 'Plain background', detail: 'No painting behind the pages, just the theme’s dark color.' }

/** The compact version, in the account menu. */
export function DisplayMenu() {
  const [d, set] = useDisplay()
  const healthId = useId()
  const row = 'flex items-center justify-between gap-3'
  return (
    <div className="space-y-2.5 px-3 py-2">
      <p className="flex items-center gap-1.5 font-body text-[0.625rem] tracking-[0.2em] text-dnd-muted uppercase">
        <SlidersHorizontal className="h-3 w-3" /> Display
      </p>
      <div className={row}>
        <span className="font-ui text-sm text-dnd-parchment">Text size</span>
        <div className="w-28">
          <Segmented
            label="Text size"
            value={d.textSize}
            onChange={(textSize) => set({ textSize })}
            options={TEXT_SIZES.map((s) => ({ id: s.id, title: s.label, content: <span className={cn('font-body leading-none', SIZE_GLYPH[s.id])} aria-label={s.label}>A</span> }))}
          />
        </div>
      </div>
      <div className={row}>
        <span className="font-ui text-sm text-dnd-parchment">Font</span>
        <div className="w-28">
          <Segmented label="Font" value={d.font} onChange={(font) => set({ font })} options={FONTS.map((f) => ({ id: f.id, title: f.detail, content: f.label }))} />
        </div>
      </div>
      <div className={row}>
        <label htmlFor={healthId} className="font-ui text-sm text-dnd-parchment">
          Health colors
        </label>
        <select
          id={healthId}
          value={d.health}
          onChange={(e) => set({ health: e.target.value as HealthColors })}
          title={HEALTH_COLORS.find((h) => h.id === d.health)?.detail}
          className="dnd-input w-28 px-2 py-1 text-xs"
        >
          {HEALTH_COLORS.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </select>
      </div>
      <Toggle label={CONTRAST.label} checked={d.contrast} onChange={(contrast) => set({ contrast })} />
      <Toggle label={CALM.label} checked={d.calm} onChange={(calm) => set({ calm })} />
      <Toggle label={PLAIN.label} checked={d.plain} onChange={(plain) => set({ plain })} />
    </div>
  )
}

function Group({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-ui text-sm text-dnd-parchment">{title}</legend>
      {detail && <p className="text-xs text-dnd-muted italic">{detail}</p>}
      {children}
    </fieldset>
  )
}

/** One option card with a live sample; `attrs` scope the sample to that option's look. */
function OptionCard({ selected, name, onSelect, label, detail, attrs, children }: {
  selected: boolean
  name: string
  onSelect: () => void
  label: string
  detail: string
  attrs?: Record<string, string>
  children: ReactNode
}) {
  return (
    <label
      {...attrs}
      className={cn(
        'flex cursor-pointer flex-col gap-2 rounded-lg border-2 p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-dnd-jade',
        selected ? 'border-dnd-jade bg-dnd-jade/10' : 'border-dnd-border hover:border-dnd-muted',
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      <span className="font-body text-sm tracking-wide text-dnd-parchment">{label}</span>
      {children}
      <span className="text-xs text-dnd-muted italic">{detail}</span>
    </label>
  )
}

/** The full version, on the account page, with a live sample of each choice. */
export function DisplaySettings() {
  const [d, set] = useDisplay()
  const fontName = useId()
  const healthName = useId()
  // The Clear sample needs its font, even before anyone picks it.
  useEffect(loadClearFont, [])

  return (
    <div className="space-y-5">
      <p className="text-sm text-dnd-muted italic">Make Karsus comfortable wherever you play: a laptop at the table, a phone in hand, or a TV across the room.</p>

      <Group title="Text size" detail="Everything grows together, so layouts stay in proportion.">
        <div className="max-w-xs">
          <Segmented
            label="Text size"
            value={d.textSize}
            onChange={(textSize) => set({ textSize })}
            options={TEXT_SIZES.map((s) => ({
              id: s.id,
              content: (
                <span className="flex items-baseline gap-1.5 py-1">
                  <span aria-hidden className={cn('font-body leading-none', SIZE_GLYPH[s.id])}>
                    A
                  </span>
                  {s.label}
                </span>
              ),
            }))}
          />
        </div>
      </Group>

      <Group title="Font">
        <div className="grid gap-2 sm:grid-cols-2">
          {FONTS.map((f) => (
            <OptionCard key={f.id} name={fontName} selected={d.font === f.id} onSelect={() => set({ font: f.id })} label={f.label} detail={f.detail} attrs={{ 'data-font-sample': f.id }}>
              <span aria-hidden className="rounded-md bg-dnd-dark/60 px-3 py-2">
                <span className="block font-body text-base text-dnd-gold">Brother Aldric</span>
                <span className="block font-ui text-sm text-dnd-parchment">AC 15, HP 27 of 33, initiative 18</span>
              </span>
            </OptionCard>
          ))}
        </div>
      </Group>

      <Group title="Health colors" detail="The colors of HP bars and health tags. Each set keeps every step easy to tell apart.">
        <div className="grid gap-2 sm:grid-cols-3">
          {HEALTH_COLORS.map((h) => (
            <OptionCard key={h.id} name={healthName} selected={d.health === h.id} onSelect={() => set({ health: h.id })} label={h.label} detail={h.detail} attrs={{ 'data-vision': h.id }}>
              <span aria-hidden className="space-y-1">
                <HpBar current={9} max={10} />
                <HpBar current={5} max={10} />
                <HpBar current={2} max={10} temp={3} />
              </span>
              <span aria-hidden className="flex flex-wrap gap-1">
                <HealthTag band="healthy" />
                <HealthTag band="bloodied" />
                <HealthTag band="critical" />
              </span>
            </OptionCard>
          ))}
        </div>
      </Group>

      <div className="space-y-3">
        <Toggle {...CONTRAST} checked={d.contrast} onChange={(contrast) => set({ contrast })} />
        <Toggle {...CALM} checked={d.calm} onChange={(calm) => set({ calm })} />
        <Toggle {...PLAIN} checked={d.plain} onChange={(plain) => set({ plain })} />
      </div>

      <p className="text-xs text-dnd-muted italic">Saved on this device, like your color theme. Contrast and motion start from your device’s own settings.</p>
    </div>
  )
}
