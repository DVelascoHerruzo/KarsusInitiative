import { useState, type FormEvent } from 'react'
import { ClipboardPaste, Dices } from 'lucide-react'
import { toast } from 'sonner'
import ImageUpload from '@/components/ui/ImageUpload'
import Modal from '@/components/ui/Modal'
import { NumberInput } from '@/components/ui/tokens'
import { numberedNames } from '@/lib/combat'
import { DiceSyntaxError, d20Notation, formatModifier, parseDice, rollDice } from '@/lib/dice'
import type { ImageKind } from '@/lib/images'
import { parseStatBlock } from '@/lib/statblock'
import type { Creature, CreaturePatch, NewCreature } from '@/lib/types'

export type CreatureFormTarget = { mode: 'add' } | { mode: 'edit'; creature: Creature }

interface CreatureFormDialogProps {
  target: CreatureFormTarget | null
  /** Presets don't track live HP or rolled initiative — monsters roll when the preset launches. */
  context: 'encounter' | 'preset'
  existingNames: string[]
  onClose: () => void
  onAdd: (creatures: NewCreature[]) => unknown
  onEdit: (id: string, patch: CreaturePatch) => void
  upload?: (file: File, kind: ImageKind) => Promise<string>
}

export function CreatureFormDialog({ target, onClose, ...rest }: CreatureFormDialogProps) {
  const editing = target?.mode === 'edit' ? target.creature : null
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : 'Add Creature'}
      description={editing ? undefined : 'Add a group at once: “Goblin” ×4 becomes Goblin 1–4, each rolled separately.'}
      size="lg"
    >
      {target && <CreatureForm key={editing?.id ?? 'new'} editing={editing} onClose={onClose} {...rest} />}
    </Modal>
  )
}

interface FormState {
  name: string
  is_player: boolean
  quantity: number
  initiative: number | null
  initiative_bonus: number
  hp: string
  current_hp: number | null
  armor_class: number | null
  notes: string
  image_url: string | null
  hidden: boolean
}

function initialState(c: Creature | null): FormState {
  return {
    name: c?.name ?? '',
    is_player: c?.is_player ?? false,
    quantity: 1,
    initiative: c?.initiative ?? null,
    initiative_bonus: c?.initiative_bonus ?? 0,
    hp: c?.max_hp?.toString() ?? '',
    current_hp: c?.current_hp ?? null,
    armor_class: c?.armor_class ?? null,
    notes: c?.notes ?? '',
    image_url: c?.image_url ?? null,
    hidden: c?.hidden ?? false,
  }
}

/** HP accepts a flat number or dice (`2d6+2`); dice roll once per creature. */
function resolveHp(hp: string): number | null {
  const text = hp.trim()
  if (!text) return null
  if (/^\d+$/.test(text)) return Math.max(1, Number(text))
  return Math.max(1, rollDice(text).total)
}

function CreatureForm({
  editing,
  context,
  existingNames,
  onClose,
  onAdd,
  onEdit,
  upload,
}: Omit<CreatureFormDialogProps, 'target'> & { editing: Creature | null }) {
  const [form, setForm] = useState<FormState>(() => initialState(editing))
  const [submitting, setSubmitting] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const hpError = (() => {
    const text = form.hp.trim()
    if (!text || /^\d+$/.test(text)) return undefined
    try {
      parseDice(text)
      return undefined
    } catch (e) {
      return e instanceof DiceSyntaxError ? e.message : 'Invalid HP'
    }
  })()
  const nameError = form.name.trim() ? undefined : 'Name is required'
  const isDiceHp = Boolean(form.hp.trim() && !/^\d+$/.test(form.hp.trim()))

  function readStatBlock() {
    const block = parseStatBlock(pasted)
    setForm((f) => ({
      ...f,
      name: block.name ?? f.name,
      armor_class: block.armor_class ?? f.armor_class,
      hp: block.max_hp?.toString() ?? f.hp,
      initiative_bonus: block.initiative_bonus ?? f.initiative_bonus,
      notes: block.notes,
    }))
    setPasting(false)
    setPasted('')
    const found = [block.armor_class !== null && 'AC', block.max_hp !== null && 'HP', block.initiative_bonus !== null && 'initiative'].filter(Boolean)
    toast(found.length ? `Read ${found.join(', ')} from the stat block` : 'Couldn’t find AC, HP or initiative in that text', {
      description: block.hp_dice ? `Hit dice ${block.hp_dice}: type them into Max HP to roll instead of the average.` : 'The full text is in the notes.',
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (nameError || hpError) return

    const shared = {
      is_player: form.is_player,
      initiative_bonus: form.initiative_bonus,
      armor_class: form.armor_class,
      notes: form.notes.trim() || null,
      image_url: form.image_url,
      hidden: form.hidden,
    }

    if (editing) {
      const max_hp = isDiceHp ? editing.max_hp : resolveHp(form.hp)
      onEdit(editing.id, {
        ...shared,
        name: form.name.trim(),
        initiative: form.initiative ?? editing.initiative,
        max_hp,
        current_hp: max_hp === null ? null : Math.min(form.current_hp ?? max_hp, max_hp),
      })
      onClose()
      return
    }

    const count = form.is_player ? 1 : form.quantity
    const creatures = numberedNames(form.name, count, existingNames).map((name): NewCreature => {
      const max_hp = resolveHp(form.hp)
      const initiative = form.initiative ?? (context === 'encounter' ? rollDice(d20Notation(form.initiative_bonus)).total : 0)
      return { ...shared, name, initiative, max_hp, current_hp: max_hp }
    })

    setSubmitting(true)
    try {
      await onAdd(creatures)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 p-6" noValidate>
      {!form.is_player && (
        <div>
          {pasting ? (
            <div className="space-y-2 rounded-lg border border-dnd-jade/40 bg-dnd-dark/60 p-4">
              <label htmlFor="stat-block" className="dnd-label">
                Stat block
              </label>
              <p className="font-ui text-xs text-dnd-muted italic">Copy a monster’s stat block from D&D Beyond, a PDF or a book, and paste it here.</p>
              <textarea
                id="stat-block"
                rows={6}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                className="dnd-input resize-y"
                placeholder={['Goblin', 'Armor Class 15 (Leather Armor, Shield)', 'Hit Points 7 (2d6)'].join('\n')}
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="dnd-button-ghost" onClick={() => setPasting(false)}>
                  Cancel
                </button>
                <button type="button" className="dnd-button-primary px-4 py-2 text-sm" disabled={!pasted.trim()} onClick={readStatBlock}>
                  Fill in the form
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="dnd-button-ghost px-3 text-sm" onClick={() => setPasting(true)}>
              <ClipboardPaste className="h-4 w-4" /> Paste a stat block
            </button>
          )}
        </div>
      )}

      <ImageUpload label="Token / Avatar" kind="portrait" value={form.image_url} onChange={(v) => set('image_url', v)} upload={upload} compact />

      <div className="grid grid-cols-3 gap-4">
        <div className={!editing && !form.is_player ? 'col-span-2' : 'col-span-3'}>
          <label htmlFor="creature-name" className="dnd-label">
            Name *
          </label>
          <input
            id="creature-name"
            data-autofocus
            className="dnd-input"
            value={form.name}
            maxLength={80}
            placeholder="Goblin Chief"
            aria-invalid={form.name && nameError ? true : undefined}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        {!editing && !form.is_player && (
          <div>
            <label htmlFor="creature-quantity" className="dnd-label">
              How many
            </label>
            <NumberInput id="creature-quantity" min={1} max={20} value={form.quantity} onValueChange={(v) => set('quantity', Math.min(20, Math.max(1, v ?? 1)))} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {context === 'encounter' && (
          <div>
            <label htmlFor="creature-initiative" className="dnd-label">
              Initiative
            </label>
            <div className="flex gap-1.5">
              <NumberInput id="creature-initiative" value={form.initiative} placeholder="Roll" onValueChange={(v) => set('initiative', v)} />
              <button
                type="button"
                className="dnd-button-secondary px-2.5 py-2"
                aria-label={`Roll ${d20Notation(form.initiative_bonus)}`}
                title={`Roll ${d20Notation(form.initiative_bonus)}`}
                onClick={() => set('initiative', rollDice(d20Notation(form.initiative_bonus)).total)}
              >
                <Dices className="h-4 w-4" />
              </button>
            </div>
            {!editing && <p className="mt-1 text-xs text-dnd-muted italic">Leave blank to roll</p>}
          </div>
        )}
        <div>
          <label htmlFor="creature-bonus" className="dnd-label">
            Init bonus
          </label>
          <NumberInput id="creature-bonus" min={-20} max={30} value={form.initiative_bonus} onValueChange={(v) => set('initiative_bonus', v ?? 0)} />
          <p className="mt-1 text-xs text-dnd-muted">{formatModifier(form.initiative_bonus)}</p>
        </div>
        <div>
          <label htmlFor="creature-ac" className="dnd-label">
            AC
          </label>
          <NumberInput id="creature-ac" min={0} max={50} value={form.armor_class} placeholder="—" onValueChange={(v) => set('armor_class', v)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className={editing && context === 'encounter' ? '' : 'col-span-2'}>
          <label htmlFor="creature-hp" className="dnd-label">
            Max HP
          </label>
          <input
            id="creature-hp"
            className="dnd-input"
            value={form.hp}
            placeholder="7 or 2d6"
            aria-invalid={hpError ? true : undefined}
            onChange={(e) => set('hp', e.target.value)}
          />
          <p className={hpError ? 'mt-1 text-xs text-red-400' : 'mt-1 text-xs text-dnd-muted italic'}>
            {hpError ?? (isDiceHp && !editing ? 'Rolled for each creature' : 'A number or dice, e.g. 2d6+2')}
          </p>
        </div>
        {editing && context === 'encounter' && (
          <div>
            <label htmlFor="creature-current" className="dnd-label">
              Current HP
            </label>
            <NumberInput id="creature-current" min={0} value={form.current_hp} onValueChange={(v) => set('current_hp', v)} />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="creature-notes" className="dnd-label">
          Notes
        </label>
        <textarea
          id="creature-notes"
          rows={3}
          maxLength={4000}
          className="dnd-input resize-y"
          value={form.notes}
          placeholder="Spells, traits, reminders… never shown to players."
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={form.is_player} onChange={(e) => set('is_player', e.target.checked)} className="h-4 w-4 rounded accent-[var(--theme-accent)]" />
          <span className="font-body text-sm text-dnd-parchment">Player Character (PC)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2" title="Kept off the player view, even on its turn, until you reveal it.">
          <input type="checkbox" checked={form.hidden} onChange={(e) => set('hidden', e.target.checked)} className="h-4 w-4 rounded accent-[var(--theme-accent)]" />
          <span className="font-body text-sm text-dnd-parchment">Hidden from players</span>
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="dnd-button-secondary flex-1">
          Cancel
        </button>
        <button type="submit" disabled={Boolean(nameError || hpError) || submitting} className="dnd-button-primary flex-1">
          {submitting ? 'Saving…' : editing ? 'Save Changes' : form.quantity > 1 && !form.is_player ? `Add ${form.quantity}` : 'Add Creature'}
        </button>
      </div>
    </form>
  )
}
