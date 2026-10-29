import { useState, type FormEvent } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { ImagePicker } from '@/components/ui/ImagePicker'
import type { ImageKind } from '@/lib/images'

export interface SceneFields {
  title: string
  description: string | null
  background_url: string | null
}

interface EncounterFormDialogProps {
  open: boolean
  onClose: () => void
  heading: string
  nameLabel?: string
  submitLabel: string
  initial?: Partial<SceneFields>
  onSubmit: (values: SceneFields) => unknown
  upload?: (file: File, kind: ImageKind) => Promise<string>
}

/** Name, description and backdrop — shared by encounters and presets. */
export function EncounterFormDialog({ open, onClose, heading, ...rest }: EncounterFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={heading}>
      {open && <SceneForm onClose={onClose} {...rest} />}
    </Dialog>
  )
}

function SceneForm({
  onClose,
  nameLabel = 'Name',
  submitLabel,
  initial,
  onSubmit,
  upload,
}: Omit<EncounterFormDialogProps, 'open' | 'heading'>) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [background, setBackground] = useState(initial?.background_url ?? null)
  const [pending, setPending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setPending(true)
    try {
      await onSubmit({ title: title.trim(), description: description.trim() || null, background_url: background })
      onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label={nameLabel}>
        {(p) => (
          <Input {...p} data-autofocus required maxLength={120} value={title} placeholder="Ambush at Hollow Ford" onChange={(e) => setTitle(e.target.value)} />
        )}
      </Field>
      <Field label="Scene description" hint="Shown under the title on the player view.">
        {(p) => (
          <Textarea {...p} rows={2} maxLength={2000} value={description} placeholder="Rain lashes the river crossing…" onChange={(e) => setDescription(e.target.value)} />
        )}
      </Field>
      <ImagePicker label="Backdrop" kind="background" value={background} onChange={setBackground} upload={upload} />
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!title.trim() || pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
