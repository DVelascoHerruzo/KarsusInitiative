import type { ReactNode } from 'react'
import { AlertCircle, Trash2 } from 'lucide-react'
import Modal from './Modal'

interface ConfirmDeleteProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  /** What's being deleted; shown in quotes. */
  name?: string
  /** Replaces the default "Are you sure…" message, for confirmations that aren't deletes. */
  body?: ReactNode
  title?: string
  confirmLabel?: string
  loading?: boolean
}

export default function ConfirmDelete({ open, onClose, onConfirm, name, body, title = 'Confirm Delete', confirmLabel = 'Delete', loading }: ConfirmDeleteProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dnd-crimson bg-dnd-crimson/15">
          <AlertCircle className="h-7 w-7 text-dnd-red" />
        </div>
        <div className="font-ui text-dnd-parchment">
          {body ?? (
            <>
              Are you sure you want to delete <span className="font-body text-dnd-gold">“{name}”</span>?
              <br />
              <span className="text-sm text-dnd-muted">This cannot be undone.</span>
            </>
          )}
        </div>
        <div className="flex w-full gap-3">
          <button type="button" onClick={onClose} className="dnd-button-secondary flex-1">
            Cancel
          </button>
          <button type="button" data-autofocus onClick={onConfirm} disabled={loading} className="dnd-button-danger flex-1">
            <Trash2 className="h-4 w-4" />
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
