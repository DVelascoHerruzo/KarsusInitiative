import { useState, type FormEvent } from 'react'
import { Dices } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, NumberInput, Switch, Textarea } from '@/components/ui/Field'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { numberedNames } from '@/lib/combat'
import { DiceSyntaxError, d20Notation, formatModifier, parseDice, rollDice } from '@/lib/dice'
import type { ImageKind } from '@/lib/images'
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
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : 'Add creature'}
      description={editing ? undefined : 'Add a whole group at once: “Goblin ×4” becomes Goblin 1–4, each rolled separately.'}
      size="lg"
    >
      {target && <CreatureForm key={editing?.id ?? 'new'} editing={editing} onClose={onClose} {...rest} />}
    </Dialog>
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
  const nameError = form.name.trim() ? undefined : 'Give it a name'
  const isDiceHp = Boolean(form.hp.trim() && !/^\d+$/.test(form.hp.trim()))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (nameError || hpError) return

    const shared = {
      is_player: form.is_player,
      initiative_bonus: form.initiative_bonus,
      armor_class: form.armor_class,
      notes: form.notes.trim() || null,
      image_url: form.image_url,
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
      const initiative =
        form.initiative ?? (context === 'encounter' ? rollDice(d20Notation(form.initiative_bonus)).total : 0)
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
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-6" noValidate>
      <Field label="Name" error={form.name && nameError} className="sm:col-span-4">
        {(p) => (
          <Input {...p} data-autofocus value={form.name} maxLength={80} placeholder="Goblin" onChange={(e) => set('name', e.target.value)} />
        )}
      </Field>
      {!editing && !form.is_player ? (
        <Field label="How many" className="sm:col-span-2">
          {(p) => (
            <NumberInput {...p} min={1} max={20} value={form.quantity} onValueChange={(v) => set('quantity', Math.min(20, Math.max(1, v ?? 1)))} />
          )}
        </Field>
      ) : (
        <div className="sm:col-span-2" />
      )}

      <div className="border-l-2 border-accent bg-canvas px-4 py-3 sm:col-span-6">
        <Switch
          checked={form.is_player}
          onCheckedChange={(v) => set('is_player', v)}
          label="Player character"
          description="Players see exact HP for PCs; monsters only show how hurt they look."
        />
      </div>

      {context === 'encounter' && (
        <Field
          label="Initiative"
          hint={editing ? undefined : 'Leave blank to roll'}
          className="sm:col-span-2"
        >
          {(p) => (
            <div className="flex gap-1.5">
              <NumberInput {...p} value={form.initiative} placeholder="Roll" onValueChange={(v) => set('initiative', v)} />
              <IconButton
                label={`Roll ${d20Notation(form.initiative_bonus)}`}
                variant="secondary"
                onClick={() => set('initiative', rollDice(d20Notation(form.initiative_bonus)).total)}
              >
                <Dices />
              </IconButton>
            </div>
          )}
        </Field>
      )}
      <Field label="Initiative bonus" hint={formatModifier(form.initiative_bonus)} className="sm:col-span-2">
        {(p) => (
          <NumberInput {...p} min={-20} max={30} value={form.initiative_bonus} onValueChange={(v) => set('initiative_bonus', v ?? 0)} />
        )}
      </Field>
      <Field label="Armor class" className="sm:col-span-2">
        {(p) => <NumberInput {...p} min={0} max={50} value={form.armor_class} onValueChange={(v) => set('armor_class', v)} />}
      </Field>

      <Field
        label="Max HP"
        error={hpError}
        hint={isDiceHp && !editing ? 'Rolled for each creature' : 'A number or dice, e.g. 2d6+2'}
        className={editing && context === 'encounter' ? 'sm:col-span-3' : 'sm:col-span-6'}
      >
        {(p) => <Input {...p} value={form.hp} inputMode="text" placeholder="7 or 2d6" onChange={(e) => set('hp', e.target.value)} />}
      </Field>
      {editing && context === 'encounter' && (
        <Field label="Current HP" className="sm:col-span-3">
          {(p) => <NumberInput {...p} min={0} value={form.current_hp} onValueChange={(v) => set('current_hp', v)} />}
        </Field>
      )}

      <div className="sm:col-span-6">
        <ImagePicker label="Portrait" kind="portrait" value={form.image_url} onChange={(v) => set('image_url', v)} upload={upload} />
      </div>

      <Field label="DM notes" hint="Never shown to players." className="sm:col-span-6">
        {(p) => (
          <Textarea {...p} rows={3} maxLength={4000} value={form.notes} placeholder="Multiattack, resistances, tactics…" onChange={(e) => set('notes', e.target.value)} />
        )}
      </Field>

      <div className="flex justify-end gap-2 sm:col-span-6">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={Boolean(nameError || hpError) || submitting}>
          {editing ? 'Save changes' : form.quantity > 1 && !form.is_player ? `Add ${form.quantity}` : 'Add to encounter'}
        </Button>
      </div>
    </form>
  )
}
