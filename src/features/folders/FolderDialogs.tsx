import { useState, type FormEvent } from 'react'
import { FolderOpen, FolderPlus } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { CampaignSelect } from '@/features/encounters/CampaignSelect'
import type { FolderControls } from './queries'

/** A folder's name, typed once: in "New folder" and in the move dialog. */
function NameForm({ onCreate, submitLabel = 'Create Folder', autoFocus }: { onCreate: (name: string) => void; submitLabel?: string; autoFocus?: boolean }) {
  const [name, setName] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(name)
    setName('')
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        className="dnd-input min-w-0 flex-1 py-2"
        aria-label="Folder name"
        data-autofocus={autoFocus || undefined}
        value={name}
        maxLength={60}
        placeholder="Session 12, Side quests…"
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="dnd-button-secondary px-4 py-2 text-sm" disabled={!name.trim()}>
        <FolderPlus className="h-4 w-4" /> {submitLabel}
      </button>
    </form>
  )
}

export function NewFolderButton({ controls }: { controls: FolderControls }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="dnd-button-secondary px-3 py-2"
        title="Make a folder to sort your encounters. Folders are private to you and don’t change who can see anything."
      >
        <FolderPlus className="h-4 w-4" /> <span className="max-sm:sr-only">New Folder</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New Folder" description="Only you see your folders. Use the folder button on an encounter to move it into one." size="sm">
        <div className="p-6">
          <NameForm
            autoFocus
            onCreate={(name) => {
              controls.create(name)
              toast.success(`Folder “${name.trim()}” created`)
              setOpen(false)
            }}
          />
        </div>
      </Modal>
    </>
  )
}

interface MoveDialogProps {
  encounter: { id: string; title: string; owner_id?: string; campaign_id: string | null } | null
  onClose: () => void
  controls: FolderControls
  /** DMs also choose the encounter's campaign, which decides which players see it. */
  campaign?: boolean
}

export function MoveDialog({ encounter, onClose, controls, campaign }: MoveDialogProps) {
  const current = encounter ? (controls.filed[encounter.id] ?? null) : null
  const choose = (folderId: string | null) => {
    if (!encounter) return
    controls.file(encounter.id, folderId)
    const name = controls.folders.find((f) => f.id === folderId)?.name
    toast.success(name ? `Moved to ${name}` : 'Taken out of its folder')
  }
  return (
    <Modal open={encounter !== null} onClose={onClose} title={`Move ${encounter?.title ?? ''}`} size="sm">
      {encounter && (
        <div className="space-y-6 p-6">
          <div>
            <p className="dnd-label flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" /> Your folder
            </p>
            <ul className="space-y-1" role="radiogroup" aria-label="Folder">
              {[{ id: null, name: 'No folder' }, ...controls.folders].map((f) => (
                <li key={f.id ?? 'none'}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={current === f.id}
                    onClick={() => choose(f.id)}
                    className={
                      current === f.id
                        ? 'flex w-full items-center gap-2 rounded-lg border border-dnd-jade/60 bg-dnd-teal/15 px-3 py-2 text-left font-body text-sm text-dnd-parchment'
                        : 'flex w-full items-center gap-2 rounded-lg border border-dnd-border/50 bg-dnd-dark/60 px-3 py-2 text-left font-body text-sm text-dnd-muted hover:text-dnd-parchment'
                    }
                  >
                    <FolderOpen className="h-4 w-4 shrink-0" /> {f.name}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <NameForm submitLabel="New" onCreate={(name) => controls.file(encounter.id, controls.create(name).id)} />
            </div>
            <p className="mt-1 font-ui text-xs text-dnd-muted italic">Only you see your folders.</p>
          </div>
          {campaign && encounter.owner_id && <CampaignSelect encounterId={encounter.id} ownerId={encounter.owner_id} value={encounter.campaign_id} className="block" />}
        </div>
      )}
    </Modal>
  )
}
