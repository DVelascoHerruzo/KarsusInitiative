import { QRCodeSVG } from 'qrcode.react'
import { Copy, ExternalLink, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'

interface ShareDialogProps {
  open: boolean
  onClose: () => void
  url: string
  /** null in the demo, where the link only works on this device. */
  enabled: boolean | null
  onToggle?: (enabled: boolean) => void
  onOpenWindow: () => void
}

export function openPlayerWindow(url: string) {
  window.open(url, 'encounter-visual-view', 'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no')
}

export function copyText(text: string, what = 'Link') {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied`),
    () => toast.error('Couldn’t copy. Select the link instead.'),
  )
}

/** The display window's link: for a TV, a projector, or everyone's phones. Read-only, no account needed. */
export function ShareDialog({ open, onClose, url, enabled, onToggle, onOpenWindow }: ShareDialogProps) {
  const live = enabled !== false
  return (
    <Modal open={open} onClose={onClose} title="Visual View" description="A live, read-only screen for the table. Anyone with the link can watch." size="lg">
      <div className="space-y-5 p-6">
        {enabled !== null && onToggle && (
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-dnd-jade/40 bg-dnd-dark/60 px-4 py-3">
            <span>
              <span className="block font-body text-sm text-dnd-parchment">Share link is on</span>
              <span className="block font-ui text-xs text-dnd-muted italic">Turn it off to close the link.</span>
            </span>
            <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="h-5 w-5 accent-[var(--theme-accent)]" />
          </label>
        )}

        {live ? (
          <>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="shrink-0 rounded-lg bg-white p-3">
                <QRCodeSVG value={url} size={148} marginSize={0} fgColor="#050F14" aria-label="QR code for the display link" />
              </div>
              <div className="w-full min-w-0 flex-1 space-y-3">
                <p className="font-ui text-sm text-dnd-muted">Players scan this, or open the link on the table screen.</p>
                <div className="flex gap-2">
                  <input readOnly value={url} aria-label="Display link" onFocus={(e) => e.target.select()} className="dnd-input min-w-0 flex-1 py-2 text-xs text-dnd-muted" />
                  <button type="button" className="dnd-button-secondary px-3 py-2" onClick={() => copyText(url)}>
                    <Copy className="h-4 w-4" /> Copy
                  </button>
                </div>
                <button type="button" className="dnd-button-primary w-full" onClick={onOpenWindow}>
                  <ExternalLink className="h-4 w-4" /> Open in a new window
                </button>
              </div>
            </div>
            <ul className="space-y-1 border-t border-dnd-border pt-4 font-ui text-xs text-dnd-muted italic">
              <li>Monsters show how hurt they look (Wounded, Bloodied…), never exact HP or AC.</li>
              <li>Notes and hidden creatures are never shown.</li>
            </ul>
          </>
        ) : (
          <p className="flex items-center gap-2 font-ui text-sm text-dnd-muted italic">
            <EyeOff className="h-4 w-4" /> The visual view is closed. Turn the link on to share it.
          </p>
        )}
      </div>
    </Modal>
  )
}
