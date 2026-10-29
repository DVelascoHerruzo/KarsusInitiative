import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import type { ImageKind } from '@/lib/images'
import { Button } from './Button'
import { Spinner } from './display'

interface ImagePickerProps {
  value: string | null
  onChange: (url: string | null) => void
  kind: ImageKind
  label: string
  /** Absent in the offline demo, where there's nowhere to store files. */
  upload?: (file: File, kind: ImageKind) => Promise<string>
}

export function ImagePicker({ value, onChange, kind, label, upload }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  async function handle(file: File | undefined) {
    if (!file || !upload) return
    setBusy(true)
    try {
      onChange(await upload(file, kind))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const shape = kind === 'portrait' ? 'size-20' : 'h-24 w-40'

  return (
    <div className="flex flex-col gap-1.5">
      <span className="cmd text-sm text-ink-muted">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={!upload || busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void handle(e.dataTransfer.files[0])
          }}
          aria-label={value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          className={cn(
            'hatch relative flex shrink-0 items-center justify-center overflow-hidden border border-line bg-canvas text-ink-faint transition-colors',
            'enabled:hover:border-accent enabled:hover:text-accent disabled:cursor-not-allowed',
            dragging && 'border-accent bg-raised text-accent',
            shape,
          )}
        >
          {value ? <img src={value} alt="" className="size-full object-cover" /> : <ImagePlus className="size-6" />}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-canvas/70">
              <Spinner />
            </span>
          )}
        </button>
        <div className="flex flex-col gap-1.5 text-xs text-ink-faint">
          {upload ? (
            <>
              <span>Click or drop an image. It’s resized automatically.</span>
              {value && (
                <Button variant="ghost" size="sm" className="-ml-3 self-start" onClick={() => onChange(null)}>
                  <Trash2 /> Remove
                </Button>
              )}
            </>
          ) : (
            <span>Images are available once you create a free account.</span>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          void handle(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
