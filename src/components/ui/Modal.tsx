import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  /** A line under the title. */
  description?: ReactNode
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const sizeClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]',
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * A dialog over the page. It animates in and out with CSS alone (see .modal-* in
 * index.css), so opening one never has to download an animation library.
 */
export default function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  // Stays mounted after `open` turns false, until the closing animation ends.
  const [shown, setShown] = useState(open)
  if (open && !shown) setShown(true)
  const closing = shown && !open
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const latestClose = useRef(onClose)
  useEffect(() => {
    latestClose.current = onClose
  })

  // Escape closes, Tab stays inside, focus moves in on open and back out on close.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        latestClose.current()
      }
      if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        if (items.length === 0) return
        const [head, tail] = [items[0]!, items[items.length - 1]!]
        if (e.shiftKey && document.activeElement === head) {
          e.preventDefault()
          tail.focus()
        } else if (!e.shiftKey && document.activeElement === tail) {
          e.preventDefault()
          head.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [open])

  return createPortal(
    shown && (
      <div
        className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
        data-closing={closing || undefined}
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) setShown(false)
        }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : 'Dialog'}
          className={`modal-panel relative w-full ${sizeClass[size]} overflow-hidden rounded-2xl border border-dnd-border bg-dnd-surface shadow-card`}
        >
          {title ? (
            <div className="flex items-start justify-between gap-3 border-b border-dnd-border px-6 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="truncate font-body text-lg tracking-widest text-dnd-gold uppercase">
                  {title}
                </h2>
                {description && <div className="mt-1 font-ui text-sm text-dnd-muted italic">{description}</div>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-dnd-muted transition-colors hover:bg-dnd-card hover:text-dnd-parchment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 z-10 rounded-full bg-dnd-card/80 p-1.5 text-dnd-muted transition-colors hover:text-dnd-parchment"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <div className={`overflow-y-auto ${size === 'full' ? 'max-h-[calc(95vh-80px)]' : 'max-h-[80vh]'}`}>{children}</div>
        </div>
      </div>
    ),
    document.body,
  )
}
