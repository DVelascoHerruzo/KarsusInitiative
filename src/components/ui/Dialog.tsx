import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  footer?: ReactNode
}

const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

/**
 * Native <dialog> in modal mode: the browser handles focus trapping, Escape,
 * inert background and top-layer stacking for us.
 */
export function Dialog({ open, onClose, title, description, size = 'md', children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      // React's autoFocus runs while the dialog is still closed, so it can't take; mark the field with data-autofocus instead.
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself, outside the panel) closes it.
        if (e.target === e.currentTarget) onClose()
      }}
      aria-labelledby={titleId}
      className={cn('m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] bg-transparent p-0 text-ink', widths[size])}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col border-t-2 border-rubric bg-panel">
          <header className="flex items-start gap-3 pr-2">
            {/* A rubric rule over a Bodoni title: the page of a folio, not another vellum slab. */}
            <h2 id={titleId} className="display min-w-0 truncate pt-4 pl-5 text-2xl leading-[1.25] text-vellum">
              {title}
            </h2>
            <div className="flex-1" />
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="mt-2 flex size-8 items-center justify-center text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 pt-4 pb-5">
            {description && <div className="mb-5 text-sm text-ink-muted">{description}</div>}
            {children}
          </div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: ReactNode
  confirmLabel?: string
  pending?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = 'Delete', pending }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" data-autofocus disabled={pending} onClick={onConfirm}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">{body}</p>
    </Dialog>
  )
}
