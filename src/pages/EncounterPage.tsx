import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, EyeOff, Pencil, Share2, Users } from 'lucide-react'
import { toast } from 'sonner'
import Layout, { PageHeader } from '@/components/ui/Layout'
import Modal from '@/components/ui/Modal'
import { EncounterBoard, type BoardActions } from '@/features/combat/EncounterBoard'
import { EncounterFormDialog } from '@/features/encounters/EncounterFormDialog'
import { FolderSelect } from '@/features/encounters/FolderSelect'
import { NotFoundError, keys, useDmPresence, useEncounter, useEncounterMutations, useEncounterPings } from '@/features/encounters/queries'
import { ShareDialog, openPlayerWindow } from '@/features/encounters/ShareDialog'
import { MembersPanel } from '@/features/members/MembersPanel'
import { usePreset } from '@/features/presets/queries'
import { ApiError } from '@/lib/api'
import { uploadImage } from '@/lib/images'

export default function EncounterPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: encounter, isPending, error } = useEncounter(id)
  const campaign = usePreset(encounter?.campaign_id ?? '', Boolean(encounter?.campaign_id))
  const m = useEncounterMutations(id)
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [inviting, setInviting] = useState(false)

  // Another device (a phone, a co-DM) changed something: resync, unless our own
  // writes are in flight — their onSettled resyncs anyway.
  useEncounterPings(encounter?.share_token, () => {
    if (qc.isMutating({ mutationKey: keys.encounter(id) }) === 0) void qc.invalidateQueries({ queryKey: keys.encounter(id) })
  })

  // Having the encounter open is what makes it live for everyone's lists.
  useDmPresence(id, Boolean(encounter))

  const playerNames = useMemo(
    () => new Map([...(campaign.data?.members ?? []), ...(encounter?.members ?? [])].map((x) => [x.user_id, x.username])),
    [campaign.data?.members, encounter?.members],
  )

  if (isPending) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <div className="animate-pulse font-body tracking-widest text-dnd-gold">Loading encounter…</div>
        </div>
      </Layout>
    )
  }

  // A player who opened the DM's link goes to their side of the table.
  if (error instanceof ApiError && error.status === 403) return <Navigate to={`/encounters/${id}/view`} replace />

  if (error || !encounter) {
    return (
      <Layout>
        <div className="py-20 text-center">
          <p className="font-body text-dnd-red">{error instanceof NotFoundError ? 'Encounter not found.' : (error?.message ?? 'Something went wrong.')}</p>
          <button type="button" onClick={() => navigate('/')} className="dnd-button-secondary mt-4">
            ‹ Back
          </button>
        </div>
      </Layout>
    )
  }

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

  const playUrl = `${window.location.origin}/play/${encounter.share_token}`

  function openVisualView() {
    if (!encounter!.share_enabled) {
      m.updateEncounter.mutate({ share_enabled: true })
      toast('Visual view link turned on', { description: 'Anyone with the link can now watch this encounter.' })
    }
    openPlayerWindow(playUrl)
  }

  return (
    <Layout title={encounter.title}>
      <title>{`${encounter.title} · Karsus`}</title>
      {encounter.background_url && (
        <div className="pointer-events-none fixed inset-0 z-0 bg-dnd-black">
          <img src={encounter.background_url} alt="" className="h-full w-full object-cover opacity-[0.22]" />
          <div className="absolute inset-0 bg-gradient-to-b from-dnd-black/50 via-transparent to-dnd-black/70" />
        </div>
      )}

      <div className="relative z-10 space-y-6">
        <PageHeader
          back={{ to: '/', label: 'Back' }}
          eyebrow={campaign.data ? `Campaign · ${campaign.data.name}` : undefined}
          title={encounter.title}
          description={encounter.description}
          actions={
            <>
              <button type="button" onClick={() => setEditing(true)} className="dnd-button-secondary px-4 py-2 text-sm">
                <Pencil className="h-4 w-4" /> Edit
              </button>
              <button type="button" onClick={() => setInviting(true)} className="dnd-button-secondary px-4 py-2 text-sm">
                {encounter.hidden ? <EyeOff className="h-4 w-4" /> : <Users className="h-4 w-4" />} Players
              </button>
              <button type="button" onClick={() => setSharing(true)} className="dnd-button-secondary px-4 py-2 text-sm" title="Share the visual view">
                <Share2 className="h-4 w-4" />
                <span className="sr-only">Share</span>
                {encounter.share_enabled && <span className="h-1.5 w-1.5 rounded-full bg-dnd-jade" aria-label="(on)" />}
              </button>
              <button type="button" onClick={openVisualView} disabled={encounter.creatures.length === 0} className="dnd-button-primary px-4 py-2 text-sm">
                <ExternalLink className="h-4 w-4" /> Visual View
              </button>
            </>
          }
        />

        {encounter.hidden && (
          <p className="flex items-center gap-2 rounded-lg border border-purple-500/40 bg-purple-950/40 px-4 py-2 font-ui text-sm text-purple-200 italic">
            <EyeOff className="h-4 w-4 shrink-0" /> Hidden from players: they don’t see this encounter until you show it.
          </p>
        )}

        <EncounterBoard encounter={encounter} actions={actions} playerNames={playerNames} />
      </div>

      <EncounterFormDialog
        open={editing}
        onClose={() => setEditing(false)}
        heading="Edit Encounter"
        nameLabel="Title"
        submitLabel="Save Changes"
        initial={encounter}
        upload={uploadImage}
        onSubmit={(v) => m.updateEncounter.mutateAsync(v)}
      />
      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Players"
        description={
          encounter.campaign_id
            ? 'Everyone in the campaign of its folder can already see it. Invite anyone else here.'
            : 'Invite players to follow the fight with their own character, or a co-DM to run it with you.'
        }
        size="lg"
      >
        <div className="space-y-5 p-6">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-purple-500/40 bg-dnd-dark/60 px-4 py-3">
            <span>
              <span className="block font-body text-sm text-dnd-parchment">Hidden from players</span>
              <span className="block font-ui text-xs text-dnd-muted italic">Players don’t see this encounter at all until you show it. The visual view link still works.</span>
            </span>
            <input type="checkbox" checked={encounter.hidden} onChange={(e) => m.updateEncounter.mutate({ hidden: e.target.checked })} className="h-5 w-5 accent-[var(--theme-accent)]" />
          </label>
          <FolderSelect encounterId={encounter.id} ownerId={encounter.owner_id} value={encounter.campaign_id} className="block" />
          <MembersPanel
            kind="encounter"
            base={`encounters/${id}`}
            queryKey={keys.encounter(id)}
            members={encounter.members}
            invites={encounter.invites}
            creatures={encounter.creatures}
          />
        </div>
      </Modal>
      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        url={playUrl}
        enabled={encounter.share_enabled}
        onToggle={(share_enabled) => m.updateEncounter.mutate({ share_enabled })}
        onOpenWindow={() => openPlayerWindow(playUrl)}
      />
    </Layout>
  )
}
