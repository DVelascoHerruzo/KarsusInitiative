import { useState } from 'react'
import { useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { MonitorPlay, Pencil, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { Button, ButtonLink } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/display'
import { EncounterBoard, type BoardActions } from '@/features/combat/EncounterBoard'
import { EncounterFormDialog } from '@/features/encounters/EncounterFormDialog'
import { NotFoundError, keys, useEncounter, useEncounterMutations, useEncounterPings } from '@/features/encounters/queries'
import { ShareDialog, openPlayerWindow } from '@/features/encounters/ShareDialog'
import { uploadImage } from '@/lib/images'

export default function EncounterPage() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const { data: encounter, isPending, error } = useEncounter(id)
  const m = useEncounterMutations(id)
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)

  // Another device (a phone, a co-DM tab) changed something: resync, unless
  // our own writes are in flight — their onSettled will resync anyway.
  useEncounterPings(encounter?.share_token, () => {
    if (qc.isMutating({ mutationKey: keys.encounter(id) }) === 0) void qc.invalidateQueries({ queryKey: keys.encounter(id) })
  })

  const actions: BoardActions = {
    advance: (step) => m.advance.mutate(step),
    updateCreature: (cid, patch) => {
      if (Object.keys(patch).length) m.updateCreature.mutate({ cid, patch })
    },
    addCreatures: (creatures) => m.addCreatures.mutateAsync(creatures),
    removeCreature: (cid) => m.removeCreature.mutate(cid),
    updateEncounter: (patch) => m.updateEncounter.mutate(patch),
    upload: uploadImage,
  }

  if (isPending) return <AppShell bleed><PageLoader label="Loading encounter" /></AppShell>

  if (error || !encounter) {
    return (
      <AppShell>
        <div className="border-l-4 border-accent py-6 pl-6">
          <h1 className="display text-4xl text-vellum">{error instanceof NotFoundError ? 'Encounter not found' : 'Something went wrong'}</h1>
          <p className="mt-3 text-ink-muted">{error instanceof NotFoundError ? 'It may have been deleted.' : error?.message}</p>
          <ButtonLink to="/" className="mt-6">Back to encounters</ButtonLink>
        </div>
      </AppShell>
    )
  }

  const playUrl = `${window.location.origin}/play/${encounter.share_token}`

  function openPlayerView() {
    if (!encounter!.share_enabled) {
      m.updateEncounter.mutate({ share_enabled: true })
      toast('Player link turned on', { description: 'Anyone with the link can now watch this encounter.' })
    }
    openPlayerWindow(playUrl)
  }

  return (
    <AppShell
      bleed
      title={encounter.title}
      subtitle={encounter.description}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> <span className="max-md:sr-only">Edit</span>
          </Button>
          <Button size="sm" onClick={() => setSharing(true)}>
            <Share2 /> <span className="max-md:sr-only">Share</span>
            {encounter.share_enabled && <span className="size-1.5 bg-accent" aria-label="(on)" />}
          </Button>
          <Button variant="secondary" size="sm" onClick={openPlayerView}>
            <MonitorPlay /> <span className="max-md:sr-only">Player view</span>
          </Button>
        </>
      }
    >
      <title>{`${encounter.title} · Karsus`}</title>
      <EncounterBoard encounter={encounter} actions={actions} />

      <EncounterFormDialog
        open={editing}
        onClose={() => setEditing(false)}
        heading="Edit encounter"
        nameLabel="Encounter name"
        submitLabel="Save"
        initial={encounter}
        upload={uploadImage}
        onSubmit={(v) => m.updateEncounter.mutateAsync(v)}
      />
      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        url={playUrl}
        enabled={encounter.share_enabled}
        onToggle={(share_enabled) => m.updateEncounter.mutate({ share_enabled })}
        onOpenWindow={() => openPlayerWindow(playUrl)}
      />
    </AppShell>
  )
}
