import { QRCodeSVG } from 'qrcode.react'
import { Copy, EyeOff, MonitorPlay } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Switch, inputClass } from '@/components/ui/Field'
import { cn } from '@/lib/cn'

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
  window.open(url, 'karsus-player-view', 'popup,width=1280,height=800')
}

export function ShareDialog({ open, onClose, url, enabled, onToggle, onOpenWindow }: ShareDialogProps) {
  const live = enabled !== false
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Player view"
      description="A live, read-only screen for the table: a TV, a projector, or everyone’s phones."
    >
      <div className="space-y-5">
        {enabled !== null && onToggle && (
          <div className="border-l-2 border-accent bg-canvas px-4 py-3">
            <Switch
              checked={enabled}
              onCheckedChange={onToggle}
              label="Share link is on"
              description="Anyone with the link can watch. Turn off to close it."
            />
          </div>
        )}

        {live ? (
          <>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="shrink-0 bg-vellum p-3">
                <QRCodeSVG value={url} size={148} marginSize={0} aria-label="QR code for the player view link" />
              </div>
              <div className="w-full min-w-0 flex-1 space-y-3">
                <p className="text-sm text-ink-muted">Players scan this, or open the link on the table screen.</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={url}
                    aria-label="Player view link"
                    onFocus={(e) => e.target.select()}
                    className={cn(inputClass, 'min-w-0 flex-1 text-xs text-ink-muted')}
                  />
                  <Button
                    onClick={() =>
                      navigator.clipboard.writeText(url).then(
                        () => toast.success('Link copied'),
                        () => toast.error('Couldn’t copy — select the link instead'),
                      )
                    }
                  >
                    <Copy /> Copy
                  </Button>
                </div>
                <Button variant="primary" className="w-full" onClick={onOpenWindow}>
                  <MonitorPlay /> Open in a new window
                </Button>
              </div>
            </div>
            <ul className="space-y-1 border-t border-line pt-4 text-xs text-ink-faint">
              <li>Monsters show how hurt they look (Wounded, Bloodied…), never exact HP or AC.</li>
              <li>DM notes are never shown.</li>
            </ul>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <EyeOff className="size-4" /> The player view is closed. Turn the link on to share it.
          </p>
        )}
      </div>
    </Dialog>
  )
}
