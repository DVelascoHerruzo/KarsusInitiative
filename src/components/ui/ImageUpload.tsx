import { useRef, useState, type DragEvent } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ImageKind } from '@/lib/images'
import { cn } from '@/lib/cn'

interface ImageUploadProps {
  value: string | null
  onChange: (url: string | null) => void
  label?: string
  kind: ImageKind
  /** Absent in the offline demo, where there's nowhere to store files. */
  upload?: (file: File, kind: ImageKind) => Promise<string>
  /** A short, wide box, for portraits in tight forms. */
  compact?: boolean
}

export default function ImageUpload({ value, onChange, label = 'Image', kind, upload, compact }: ImageUploadProps) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  async function handle(file: File | undefined) {
    if (!file || !upload) return
    setUploading(true)
    try {
      onChange(await upload(file, kind))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to upload image')
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    void handle(e.dataTransfer.files[0])
  }

  const height = compact ? 'h-28' : 'h-40'
  const picker = (
    <input ref={input} type="file" accept="image/*" className="hidden" aria-label={label} onChange={(e) => void handle(e.target.files?.[0])} />
  )

  return (
    <div>
      <span className="dnd-label">{label}</span>
      {picker}
      {value ? (
        <div className="group relative">
          <img src={value} alt="" className={cn('w-full rounded-lg border border-dnd-border object-cover', height)} />
          <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-lg bg-black/50 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            {upload && (
              <button
                type="button"
                onClick={() => input.current?.click()}
                aria-label={`Replace ${label.toLowerCase()}`}
                className="rounded-full bg-dnd-surface p-2 text-dnd-parchment hover:bg-dnd-card"
              >
                <Upload className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={`Remove ${label.toLowerCase()}`}
              className="rounded-full bg-dnd-crimson/80 p-2 text-white hover:bg-dnd-red"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={!upload || uploading}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center text-dnd-muted transition-colors disabled:cursor-not-allowed',
            compact ? 'p-4' : 'p-6',
            dragging ? 'border-dnd-gold bg-dnd-gold/5' : 'border-dnd-border hover:border-dnd-teal hover:bg-dnd-surface/50',
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-dnd-gold" />
              <span className="font-ui text-sm">Uploading…</span>
            </>
          ) : upload ? (
            <>
              <Upload className={compact ? 'h-6 w-6' : 'h-8 w-8'} />
              <span className="font-ui text-sm">{dragging ? 'Drop here…' : 'Click or drag to upload'}</span>
              <span className="text-xs opacity-60">PNG, JPG or WEBP, resized automatically</span>
            </>
          ) : (
            <span className="font-ui text-sm italic">Sign in to add images</span>
          )}
        </button>
      )}
    </div>
  )
}
