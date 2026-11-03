import { useState, type FormEvent } from 'react'
import ImageUpload from '@/components/ui/ImageUpload'
import Modal from '@/components/ui/Modal'
import type { ImageKind } from '@/lib/images'
import type { NewEncounter } from '@/lib/types'

interface EncounterFormDialogProps {
  open: boolean
  onClose: () => void
  heading: string
  nameLabel: string
  submitLabel: string
  initial?: Partial<NewEncounter>
  upload?: (file: File, kind: ImageKind) => Promise<string>
  onSubmit: (values: NewEncounter) => Promise<unknown> | unknown
  placeholder?: string
}

/** Name, description and backdrop: the same three fields for encounters and presets. */
export function EncounterFormDialog({ open, onClose, heading, ...rest }: EncounterFormDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={heading}>
      {open && <EncounterForm onClose={onClose} {...rest} />}
    </Modal>
  )
}

function EncounterForm({ onClose, nameLabel, submitLabel, initial, upload, onSubmit, placeholder = 'The Final Showdown' }: Omit<EncounterFormDialogProps, 'open' | 'heading'>) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [background, setBackground] = useState<string | null>(initial?.background_url ?? null)
  const [submitting, setSubmitting] = useState(false)
  const error = title.trim() ? undefined : `${nameLabel} is required`

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (error) return
    setSubmitting(true)
    try {
      await onSubmit({ title: title.trim(), description: description.trim() || null, background_url: background })
      onClose()
    } catch {
      // The mutation already showed the error; keep the form open to fix it.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 p-6" noValidate>
      <div>
        <label htmlFor="encounter-title" className="dnd-label">
          {nameLabel} *
        </label>
        <input
          id="encounter-title"
          data-autofocus
          className="dnd-input"
          value={title}
          maxLength={120}
          placeholder={placeholder}
          aria-invalid={title && error ? true : undefined}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="encounter-description" className="dnd-label">
          Description
        </label>
        <textarea
          id="encounter-description"
          rows={3}
          maxLength={2000}
          className="dnd-input resize-none"
          value={description}
          placeholder="A brief description of the scene…"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <ImageUpload label="Background Image" kind="background" value={background} onChange={setBackground} upload={upload} />

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="dnd-button-secondary flex-1">
          Cancel
        </button>
        <button type="submit" disabled={Boolean(error) || submitting} className="dnd-button-primary flex-1">
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
