import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { Token } from '@/components/ui/tokens'
import { formatModifier } from '@/lib/dice'
import { cn } from '@/lib/cn'
import {
  ABILITIES,
  SKILLS,
  abilityModifier,
  classSummary,
  emptySheet,
  passivePerception,
  proficiencyBonus,
  saveBonus,
  skillBonus,
  spellAttackBonus,
  spellSaveDc,
  totalLevel,
} from '@/lib/sheet'
import type { CharacterSheet, Creature, SpellSlots } from '@/lib/types'
import { ordinal } from './CharacterSheetDialog'

interface CharacterSheetViewProps {
  character: Creature
  /** Marks spell slots spent or recovered. Absent: the pips are read-only. */
  onSlots?: (patch: Pick<CharacterSheet, 'spell_slots' | 'pact_slots'>) => void
  actions?: ReactNode
}

/** A character at a glance: the numbers that come up at the table, then everything else. */
export function CharacterSheetView({ character: c, onSlots, actions }: CharacterSheetViewProps) {
  const sheet = c.sheet ?? emptySheet()
  const level = totalLevel(sheet.classes)
  const dc = spellSaveDc(sheet)
  const attack = spellAttackBonus(sheet)
  const hasSlots = sheet.spell_slots.length > 0 || sheet.pact_slots !== null
  const spend = (slots: SpellSlots, used: number) => ({ ...slots, used: Math.max(0, Math.min(slots.max, used)) })

  return (
    <article className="space-y-6">
      <header className="dnd-card flex flex-wrap items-center gap-5 overflow-hidden p-5">
        {c.image_url ? (
          <img src={c.image_url} alt="" className="h-24 w-24 shrink-0 rounded-full border-2 border-dnd-gold object-cover shadow-glow-gold" />
        ) : (
          <Token name={c.name} src={null} isPlayer size={96} active />
        )}
        <div className="min-w-48 flex-1">
          <p className="font-body text-xs tracking-[0.3em] text-dnd-jade uppercase">Your Character</p>
          <h2 className="font-display text-3xl break-words text-dnd-gold">{c.name}</h2>
          <p className="mt-1 font-ui text-dnd-muted italic">
            {[sheet.species, classSummary(sheet.classes) || null, sheet.background].filter(Boolean).join(' · ') || 'No class or species yet'}
          </p>
          {sheet.source_url && (
            <a href={sheet.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-body text-[0.6875rem] tracking-wider text-dnd-muted hover:text-dnd-jade">
              On D&D Beyond <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </header>

      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="Armor Class" value={c.armor_class ?? '—'} />
        <Stat label="Hit Points" value={c.max_hp ?? '—'} />
        <Stat label="Speed" value={sheet.speed ?? '—'} sub={sheet.speed !== null ? 'ft' : undefined} />
        <Stat label="Initiative" value={formatModifier(c.initiative_bonus)} />
        <Stat label="Proficiency" value={formatModifier(proficiencyBonus(level))} />
        <Stat label="Passive Perc." value={passivePerception(sheet)} />
      </dl>

      <section aria-labelledby="abilities" className="dnd-card p-5">
        <SectionTitle id="abilities">Abilities</SectionTitle>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ABILITIES.map((a) => (
            <li key={a.key} className="rounded-lg border border-dnd-border/50 bg-dnd-dark/60 px-3 pt-2 pb-3 text-center">
              <p className="font-body text-xs tracking-widest text-dnd-jade uppercase" title={a.name}>
                {a.label}
              </p>
              <p className="mt-1 font-display text-3xl text-dnd-gold">{formatModifier(abilityModifier(sheet.abilities[a.key]))}</p>
              <p className="font-body text-sm text-dnd-parchment">{sheet.abilities[a.key]}</p>
              <p className={cn('mt-1.5 text-xs', sheet.saves.includes(a.key) ? 'text-dnd-jade' : 'text-dnd-muted')}>save {formatModifier(saveBonus(sheet, a.key))}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="skills" className="dnd-card p-5">
        <SectionTitle id="skills">Skills</SectionTitle>
        <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map((s) => {
            const state = sheet.skills[s.key]
            return (
              <li key={s.key} className="flex items-baseline gap-3 border-b border-dnd-border/40 py-1.5 text-sm">
                <span className={cn('flex-1 font-ui', state ? 'text-dnd-parchment' : 'text-dnd-muted')}>
                  {s.name}
                  {state === 'expertise' && <span className="text-xs text-dnd-jade italic"> expertise</span>}
                </span>
                <span className={cn('font-body', state ? 'text-dnd-gold' : 'text-dnd-muted')}>{formatModifier(skillBonus(sheet, s.key))}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {(dc !== null || hasSlots) && (
        <section aria-labelledby="spells" className="dnd-card p-5">
          <SectionTitle id="spells" aside={dc !== null && attack !== null ? `Save DC ${dc} · Attack ${formatModifier(attack)}` : undefined}>
            Spell Slots
          </SectionTitle>
          {hasSlots ? (
            <ul className="flex flex-wrap gap-x-8 gap-y-4">
              {sheet.spell_slots.map((slots, i) => (
                <SlotPips
                  key={slots.level}
                  label={ordinal(slots.level)}
                  slots={slots}
                  onChange={onSlots && ((used) => onSlots({ spell_slots: sheet.spell_slots.map((s, j) => (j === i ? spend(s, used) : s)), pact_slots: sheet.pact_slots }))}
                />
              ))}
              {sheet.pact_slots && (
                <SlotPips
                  label={`Pact ${ordinal(sheet.pact_slots.level)}`}
                  slots={sheet.pact_slots}
                  onChange={onSlots && ((used) => onSlots({ spell_slots: sheet.spell_slots, pact_slots: spend(sheet.pact_slots!, used) }))}
                />
              )}
            </ul>
          ) : (
            <p className="font-ui text-sm text-dnd-muted italic">No slots set. Edit the sheet to fill them in from your classes.</p>
          )}
          {onSlots && hasSlots && (
            <button
              type="button"
              onClick={() => onSlots({ spell_slots: sheet.spell_slots.map((s) => ({ ...s, used: 0 })), pact_slots: sheet.pact_slots && { ...sheet.pact_slots, used: 0 } })}
              className="dnd-button-ghost mt-4 px-3 text-sm"
            >
              Long rest: recover every slot
            </button>
          )}
        </section>
      )}

      {sheet.inventory.length > 0 && (
        <section aria-labelledby="inventory" className="dnd-card p-5">
          <SectionTitle id="inventory">Inventory</SectionTitle>
          <ul className="grid gap-x-8 sm:grid-cols-2">
            {sheet.inventory.map((item, i) => (
              <li key={i} className="flex items-baseline gap-3 border-b border-dnd-border/40 py-1.5 text-sm">
                <span className="flex-1 font-ui text-dnd-parchment">{item.name}</span>
                {item.equipped && <span className="text-xs text-dnd-jade italic">worn</span>}
                {item.quantity !== 1 && <span className="font-body text-dnd-muted">×{item.quantity}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sheet.player_notes && (
        <section aria-labelledby="notes" className="dnd-card p-5">
          <SectionTitle id="notes">Notes</SectionTitle>
          <p className="max-w-prose font-ui leading-relaxed whitespace-pre-wrap text-dnd-parchment/85">{sheet.player_notes}</p>
        </section>
      )}
    </article>
  )
}

function SectionTitle({ id, aside, children }: { id: string; aside?: string; children: ReactNode }) {
  return (
    <header className="mb-3 flex flex-wrap items-baseline gap-x-3">
      <h3 id={id} className="font-body text-base tracking-widest text-dnd-gold uppercase">
        {children}
      </h3>
      {aside && <p className="font-ui text-sm text-dnd-muted italic">{aside}</p>}
    </header>
  )
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="dnd-card px-3 pt-2 pb-2.5 text-center">
      <dt className="font-body text-[0.625rem] tracking-widest text-dnd-muted uppercase">{label}</dt>
      <dd className="mt-1 font-display text-2xl text-dnd-parchment">
        {value}
        {sub && <span className="ml-1 font-body text-xs text-dnd-muted">{sub}</span>}
      </dd>
    </div>
  )
}

/** One gem per slot; lit gems are still available. Tapping the last lit one spends it. */
function SlotPips({ label, slots, onChange }: { label: string; slots: SpellSlots; onChange?: (used: number) => void }) {
  const left = slots.max - slots.used
  return (
    <li>
      <p className="mb-1.5 font-body text-[0.6875rem] tracking-widest text-dnd-muted uppercase">
        {label} <span className="text-dnd-parchment">{left}/{slots.max}</span>
      </p>
      <div className="flex gap-1.5">
        {Array.from({ length: slots.max }, (_, i) => {
          const available = i < left
          const pip = <span className={cn('block h-4 w-4 rotate-45 rounded-sm border', available ? 'border-dnd-jade bg-dnd-jade shadow-glow-jade' : 'border-dnd-border bg-transparent')} />
          return onChange ? (
            <button
              key={i}
              type="button"
              aria-label={available ? `Spend a ${label} slot` : `Recover a ${label} slot`}
              onClick={() => onChange(available ? slots.max - i : slots.max - i - 1)}
              className="p-1 hover:opacity-80"
            >
              {pip}
            </button>
          ) : (
            <span key={i} className="p-1">
              {pip}
            </span>
          )
        })}
      </div>
    </li>
  )
}
