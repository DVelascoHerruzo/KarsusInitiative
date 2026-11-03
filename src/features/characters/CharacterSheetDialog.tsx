import { useState, type FormEvent, type ReactNode } from 'react'
import { Download, Plus, Trash2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import ImageUpload from '@/components/ui/ImageUpload'
import Modal from '@/components/ui/Modal'
import { NumberInput } from '@/components/ui/tokens'
import { importFromDndBeyond } from '@/features/player/queries'
import { formatModifier } from '@/lib/dice'
import { cn } from '@/lib/cn'
import type { ImageKind } from '@/lib/images'
import {
  ABILITIES,
  SKILLS,
  abilityModifier,
  castingAbilityFor,
  emptySheet,
  passivePerception,
  proficiencyBonus,
  saveBonus,
  skillBonus,
  slotsFor,
  spellSaveDc,
  totalLevel,
} from '@/lib/sheet'
import type { Ability, CharacterSheet, NewCreature, Proficiency, Skill, SpellSlots } from '@/lib/types'

/** What the sheet form edits: the character's own fields, never the DM's (notes, hidden). */
export type CharacterDraft = Pick<NewCreature, 'name' | 'image_url' | 'initiative_bonus' | 'max_hp' | 'armor_class' | 'initiative'> & {
  sheet: CharacterSheet
}

interface CharacterSheetDialogProps {
  open: boolean
  onClose: () => void
  title: string
  submitLabel: string
  /** The character being edited; absent to start a new one. */
  initial?: Partial<NewCreature> | null
  /** Ask for an initiative roll too: joining a fight that's already set up. */
  askInitiative?: boolean
  onSubmit: (draft: CharacterDraft) => unknown
  upload?: (file: File, kind: ImageKind) => Promise<string>
}

export function CharacterSheetDialog({ open, onClose, title, ...rest }: CharacterSheetDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="xl">
      {open && <SheetForm onClose={onClose} {...rest} />}
    </Modal>
  )
}

function draftFrom(c: Partial<NewCreature> | null | undefined): CharacterDraft {
  return {
    name: c?.name ?? '',
    image_url: c?.image_url ?? null,
    initiative_bonus: c?.initiative_bonus ?? 0,
    max_hp: c?.max_hp ?? null,
    armor_class: c?.armor_class ?? null,
    initiative: c?.initiative,
    sheet: structuredClone(c?.sheet ?? emptySheet()),
  }
}

const SKILL_STATES: (Proficiency | undefined)[] = [undefined, 'proficient', 'expertise']
const SKILL_MARK = { none: '○', proficient: '●', expertise: '◆' }

function SheetForm({ onClose, submitLabel, initial, askInitiative, onSubmit, upload }: Omit<CharacterSheetDialogProps, 'open' | 'title'>) {
  const [draft, setDraft] = useState<CharacterDraft>(() => draftFrom(initial))
  const [ddbUrl, setDdbUrl] = useState(initial?.sheet?.source_url ?? '')
  const [importing, setImporting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const sheet = draft.sheet
  const level = totalLevel(sheet.classes)
  const set = <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setSheet = (patch: Partial<CharacterSheet>) => setDraft((d) => ({ ...d, sheet: { ...d.sheet, ...patch } }))
  const nameError = draft.name.trim() ? undefined : 'Name is required'
  const incomplete = sheet.classes.some((c) => !c.name.trim()) || sheet.inventory.some((x) => !x.name.trim())

  async function runImport() {
    setImporting(true)
    try {
      const imported = await importFromDndBeyond(ddbUrl)
      // Keep a roll the player already typed; everything else comes from D&D Beyond.
      setDraft((d) => ({ ...draftFrom(imported), initiative: d.initiative }))
      toast.success(`Imported ${imported.name}`, { description: 'Check HP, AC and speed: D&D Beyond doesn’t share how it worked them out.' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (nameError || incomplete) return
    setSubmitting(true)
    try {
      await onSubmit({ ...draft, name: draft.name.trim() })
      onClose()
    } catch {
      // The mutation already reported it; keep the sheet open.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="space-y-8 p-6">
        <div className="rounded-lg border border-dnd-jade/40 bg-dnd-dark/60 p-4">
          <label htmlFor="ddb-url" className="dnd-label">
            Import from D&D Beyond
          </label>
          <p className="font-ui text-xs text-dnd-muted italic">Paste your character’s link. The character needs to be public on D&D Beyond.</p>
          <div className="mt-3 flex gap-2">
            <input
              id="ddb-url"
              className="dnd-input min-w-0 flex-1 py-2"
              value={ddbUrl}
              inputMode="url"
              placeholder="https://www.dndbeyond.com/characters/123456"
              onChange={(e) => setDdbUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (ddbUrl.trim()) void runImport()
                }
              }}
            />
            <button type="button" className="dnd-button-secondary px-4 py-2" onClick={runImport} disabled={!ddbUrl.trim() || importing}>
              <Download className="h-4 w-4" /> {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>

        <Section title="Character">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div className="space-y-4">
              <div>
                <label htmlFor="sheet-name" className="dnd-label">
                  Name *
                </label>
                <input
                  id="sheet-name"
                  data-autofocus
                  className="dnd-input"
                  value={draft.name}
                  maxLength={80}
                  placeholder="Vex Tallowmere"
                  aria-invalid={draft.name && nameError ? true : undefined}
                  onChange={(e) => set('name', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sheet-species" className="dnd-label">
                    Species
                  </label>
                  <input id="sheet-species" className="dnd-input" value={sheet.species ?? ''} maxLength={60} placeholder="Wood Elf" onChange={(e) => setSheet({ species: e.target.value || null })} />
                </div>
                <div>
                  <label htmlFor="sheet-background" className="dnd-label">
                    Background
                  </label>
                  <input
                    id="sheet-background"
                    className="dnd-input"
                    value={sheet.background ?? ''}
                    maxLength={60}
                    placeholder="Criminal"
                    onChange={(e) => setSheet({ background: e.target.value || null })}
                  />
                </div>
              </div>
            </div>
            <ImageUpload label="Portrait" kind="portrait" value={draft.image_url ?? null} onChange={(v) => set('image_url', v)} upload={upload} compact />
          </div>

          <div className="mt-5">
            <p className="dnd-label">Classes</p>
            <ul className="space-y-2">
              {sheet.classes.map((c, i) => (
                <li key={i} className="grid grid-cols-[1fr_1fr_4.5rem_auto] gap-2">
                  <input
                    aria-label="Class"
                    className="dnd-input py-2"
                    value={c.name}
                    maxLength={40}
                    placeholder="Rogue"
                    onChange={(e) => setSheet({ classes: sheet.classes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                  />
                  <input
                    aria-label="Subclass"
                    className="dnd-input py-2"
                    value={c.subclass ?? ''}
                    maxLength={60}
                    placeholder="Subclass"
                    onChange={(e) => setSheet({ classes: sheet.classes.map((x, j) => (j === i ? { ...x, subclass: e.target.value || null } : x)) })}
                  />
                  <NumberInput
                    aria-label="Level"
                    className="py-2"
                    min={1}
                    max={20}
                    value={c.level}
                    onValueChange={(v) => setSheet({ classes: sheet.classes.map((x, j) => (j === i ? { ...x, level: Math.min(20, Math.max(1, v ?? 1)) } : x)) })}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${c.name || 'class'}`}
                    className="rounded p-2 text-dnd-muted hover:text-dnd-red"
                    onClick={() => setSheet({ classes: sheet.classes.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="dnd-button-ghost mt-2 px-3 text-sm" onClick={() => setSheet({ classes: [...sheet.classes, { name: '', subclass: null, level: 1 }] })}>
              <Plus className="h-4 w-4" /> Add {sheet.classes.length ? 'a multiclass' : 'a class'}
            </button>
            {level > 0 && (
              <p className="mt-1 font-ui text-xs text-dnd-muted italic">
                Level {level}, proficiency bonus {formatModifier(proficiencyBonus(level))}
              </p>
            )}
          </div>
        </Section>

        <Section title="In Combat">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="sheet-hp" className="dnd-label">
                Max HP
              </label>
              <NumberInput id="sheet-hp" min={1} value={draft.max_hp ?? null} onValueChange={(v) => set('max_hp', v)} />
            </div>
            <div>
              <label htmlFor="sheet-ac" className="dnd-label">
                Armor Class
              </label>
              <NumberInput id="sheet-ac" min={0} max={50} value={draft.armor_class ?? null} onValueChange={(v) => set('armor_class', v)} />
            </div>
            <div>
              <label htmlFor="sheet-speed" className="dnd-label">
                Speed (ft)
              </label>
              <NumberInput id="sheet-speed" min={0} max={500} value={sheet.speed} onValueChange={(v) => setSheet({ speed: v })} />
            </div>
            <div>
              <label htmlFor="sheet-init" className="dnd-label">
                Init bonus
              </label>
              <NumberInput id="sheet-init" min={-20} max={30} value={draft.initiative_bonus ?? 0} onValueChange={(v) => set('initiative_bonus', v ?? 0)} />
              <p className="mt-1 font-ui text-xs text-dnd-muted italic">Dex alone: {formatModifier(abilityModifier(sheet.abilities.dex))}</p>
            </div>
            {askInitiative && (
              <div className="col-span-2">
                <label htmlFor="sheet-roll" className="dnd-label">
                  Initiative roll
                </label>
                <NumberInput id="sheet-roll" min={-100} max={100} value={draft.initiative ?? null} onValueChange={(v) => set('initiative', v ?? undefined)} />
                <p className="mt-1 font-ui text-xs text-dnd-muted italic">What you rolled for this fight</p>
              </div>
            )}
          </div>
        </Section>

        <Section title="Abilities" aside="Tick the saving throws you’re proficient in.">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {ABILITIES.map((a) => {
              const proficient = sheet.saves.includes(a.key)
              return (
                <div key={a.key} className="rounded-lg border border-dnd-border/50 bg-dnd-dark/60 p-3 text-center">
                  <label htmlFor={`score-${a.key}`} className="block font-body text-xs tracking-widest text-dnd-jade uppercase" title={a.name}>
                    {a.label}
                  </label>
                  <NumberInput
                    id={`score-${a.key}`}
                    min={1}
                    max={30}
                    value={sheet.abilities[a.key]}
                    onValueChange={(v) => setSheet({ abilities: { ...sheet.abilities, [a.key]: Math.min(30, Math.max(1, v ?? 10)) } })}
                    className="mt-1.5 px-1 py-1.5 text-center font-display text-lg"
                  />
                  <p className="mt-1 font-body text-sm text-dnd-gold">{formatModifier(abilityModifier(sheet.abilities[a.key]))}</p>
                  <label className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-dnd-muted">
                    <input
                      type="checkbox"
                      checked={proficient}
                      onChange={() => setSheet({ saves: proficient ? sheet.saves.filter((s) => s !== a.key) : [...sheet.saves, a.key] })}
                      className="accent-[var(--theme-accent)]"
                    />
                    save {formatModifier(saveBonus(sheet, a.key))}
                  </label>
                </div>
              )
            })}
          </div>
        </Section>

        <Section
          title="Skills"
          aside={`Tap to cycle: ${SKILL_MARK.none} none, ${SKILL_MARK.proficient} proficient, ${SKILL_MARK.expertise} expertise. Passive Perception ${passivePerception(sheet)}.`}
        >
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {SKILLS.map((s) => {
              const state = sheet.skills[s.key]
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    aria-label={`${s.name}: ${state ?? 'not proficient'}. Change`}
                    onClick={() => setSheet({ skills: cycleSkill(sheet.skills, s.key) })}
                    className="flex w-full items-center gap-3 border-b border-dnd-border/40 px-1 py-1.5 text-left text-sm hover:bg-dnd-surface/50"
                  >
                    <span aria-hidden className={cn('w-4 text-center', state ? 'text-dnd-jade' : 'text-dnd-muted')}>
                      {SKILL_MARK[state ?? 'none']}
                    </span>
                    <span className="flex-1 font-ui text-dnd-parchment">{s.name}</span>
                    <span className="font-body text-[10px] tracking-widest text-dnd-muted uppercase">{s.ability}</span>
                    <span className="w-8 text-right font-body text-dnd-gold">{formatModifier(skillBonus(sheet, s.key))}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Section>

        <Section title="Spellcasting" aside={spellSaveDc(sheet) !== null ? `Spell save DC ${spellSaveDc(sheet)}` : 'Leave the ability empty if you don’t cast spells.'}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-52">
              <label htmlFor="sheet-casting" className="dnd-label">
                Casting ability
              </label>
              <select
                id="sheet-casting"
                className="dnd-input"
                value={sheet.spellcasting_ability ?? ''}
                onChange={(e) => setSheet({ spellcasting_ability: (e.target.value || null) as Ability | null })}
              >
                <option value="">None</option>
                {ABILITIES.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="dnd-button-ghost"
              disabled={sheet.classes.length === 0}
              onClick={() => setSheet({ ...slotsFor(sheet.classes), spellcasting_ability: sheet.spellcasting_ability ?? castingAbilityFor(sheet.classes) })}
            >
              <Wand2 className="h-4 w-4" /> Fill in slots from my classes
            </button>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-9">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((lvl) => (
              <div key={lvl}>
                <label htmlFor={`slots-${lvl}`} className="mb-1 block text-center font-body text-[10px] tracking-widest text-dnd-muted uppercase">
                  {ordinal(lvl)}
                </label>
                <NumberInput
                  id={`slots-${lvl}`}
                  min={0}
                  max={20}
                  placeholder="0"
                  value={sheet.spell_slots.find((s) => s.level === lvl)?.max || null}
                  onValueChange={(v) => setSheet({ spell_slots: withSlotMax(sheet.spell_slots, lvl, v ?? 0) })}
                  className="px-1 py-1.5 text-center"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 grid max-w-sm grid-cols-2 gap-3">
            <div>
              <label htmlFor="pact-count" className="dnd-label">
                Pact slots
              </label>
              <NumberInput
                id="pact-count"
                min={0}
                max={4}
                value={sheet.pact_slots?.max ?? null}
                onValueChange={(v) => setSheet({ pact_slots: v ? { level: sheet.pact_slots?.level ?? 1, max: v, used: Math.min(v, sheet.pact_slots?.used ?? 0) } : null })}
              />
              <p className="mt-1 font-ui text-xs text-dnd-muted italic">Warlocks: how many</p>
            </div>
            <div>
              <label htmlFor="pact-level" className="dnd-label">
                Slot level
              </label>
              <NumberInput
                id="pact-level"
                min={1}
                max={5}
                disabled={!sheet.pact_slots}
                value={sheet.pact_slots?.level ?? null}
                onValueChange={(v) => sheet.pact_slots && setSheet({ pact_slots: { ...sheet.pact_slots, level: Math.min(5, Math.max(1, v ?? 1)) } })}
              />
            </div>
          </div>
        </Section>

        <Section title="Inventory">
          <ul className="space-y-2">
            {sheet.inventory.map((item, i) => (
              <li key={i} className="grid grid-cols-[1fr_4.5rem_auto_auto] items-center gap-2">
                <input
                  aria-label="Item"
                  className="dnd-input py-2"
                  value={item.name}
                  maxLength={80}
                  placeholder="Rope, 50 ft"
                  onChange={(e) => setSheet({ inventory: sheet.inventory.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                />
                <NumberInput
                  aria-label={`Quantity of ${item.name || 'item'}`}
                  className="py-2"
                  min={0}
                  value={item.quantity}
                  onValueChange={(v) => setSheet({ inventory: sheet.inventory.map((x, j) => (j === i ? { ...x, quantity: Math.max(0, v ?? 0) } : x)) })}
                />
                <label className="flex items-center gap-1.5 text-xs text-dnd-muted">
                  <input
                    type="checkbox"
                    checked={item.equipped}
                    onChange={() => setSheet({ inventory: sheet.inventory.map((x, j) => (j === i ? { ...x, equipped: !x.equipped } : x)) })}
                    className="accent-[var(--theme-accent)]"
                  />
                  worn
                </label>
                <button
                  type="button"
                  aria-label={`Remove ${item.name || 'item'}`}
                  className="rounded p-1.5 text-dnd-muted hover:text-dnd-red"
                  onClick={() => setSheet({ inventory: sheet.inventory.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="dnd-button-ghost mt-2 px-3 text-sm"
            onClick={() => setSheet({ inventory: [...sheet.inventory, { name: '', quantity: 1, equipped: false }] })}
          >
            <Plus className="h-4 w-4" /> Add an item
          </button>
        </Section>

        <Section title="Notes" aside="Your DM can read these; the other players can’t.">
          <textarea
            aria-label="Your notes"
            rows={4}
            maxLength={8000}
            className="dnd-input resize-y"
            value={sheet.player_notes ?? ''}
            placeholder="Features, spells known, who you owe money to…"
            onChange={(e) => setSheet({ player_notes: e.target.value || null })}
          />
        </Section>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-dnd-border bg-dnd-surface px-6 py-4">
        <button type="button" onClick={onClose} className="dnd-button-secondary">
          Cancel
        </button>
        <button type="submit" className="dnd-button-primary" disabled={Boolean(nameError) || submitting || incomplete}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-dnd-border pb-2">
        <h3 className="font-body text-base tracking-widest text-dnd-gold uppercase">{title}</h3>
        {aside && <p className="font-ui text-xs text-dnd-muted italic">{aside}</p>}
      </header>
      {children}
    </section>
  )
}

function cycleSkill(skills: CharacterSheet['skills'], key: Skill): CharacterSheet['skills'] {
  const next = SKILL_STATES[(SKILL_STATES.indexOf(skills[key]) + 1) % SKILL_STATES.length]
  const { [key]: _old, ...rest } = skills
  return next ? { ...rest, [key]: next } : rest
}

function withSlotMax(slots: readonly SpellSlots[], level: number, max: number): SpellSlots[] {
  const others = slots.filter((s) => s.level !== level)
  if (max <= 0) return others
  const used = Math.min(max, slots.find((s) => s.level === level)?.used ?? 0)
  return [...others, { level, max, used }].sort((a, b) => a.level - b.level)
}

export const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
