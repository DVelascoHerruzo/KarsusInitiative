import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Pencil, RotateCcw, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmDelete from '@/components/ui/ConfirmDelete'
import Layout, { PageHeader } from '@/components/ui/Layout'
import { useAuth } from '@/features/auth/AuthProvider'
import { EncounterBoard, type BoardActions } from '@/features/combat/EncounterBoard'
import { EncounterFormDialog } from '@/features/encounters/EncounterFormDialog'
import { NotFoundError, keys, useEncounter, useEncounterMutations, withConditions } from '@/features/encounters/queries'
import { ShareDialog, openPlayerWindow } from '@/features/encounters/ShareDialog'
import { api } from '@/lib/api'
import type { Creature, Encounter, EncounterPatch, GuestSession, NewEncounter } from '@/lib/types'

/** What a guest sees before their first change: nothing is saved anywhere yet. */
const BLANK: Encounter = {
  id: 'new',
  owner_id: '',
  title: 'New encounter',
  description: null,
  background_url: null,
  round: 1,
  active_creature_id: null,
  share_token: '',
  share_enabled: false,
  campaign_id: null,
  hidden: false,
  members: [],
  invites: { player: null, dm: null },
  created_at: '',
  updated_at: '',
  creatures: [],
}

const endsOn = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

/** Above the board: what's kept, until when, and how to keep it for good. */
function GuestBanner({ guest }: { guest: GuestSession | null }) {
  return (
    <section className="dnd-card flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Playing without an account">
      <div className="min-w-0">
        <p className="font-body text-sm tracking-wide text-dnd-parchment">{guest ? `Saved on this device until ${endsOn(guest.expires_at)}` : 'Run a fight now, no account needed'}</p>
        <p className="mt-0.5 font-ui text-sm text-dnd-muted italic">
          {guest
            ? 'Create a free account to keep this encounter and its player view link, and to add campaigns, folders, player invites and portraits.'
            : 'Your first change saves this encounter on this device for 7 days, player view link included. A free account keeps it for good.'}
        </p>
      </div>
      <Link to="/login" state={{ mode: 'register' }} className="dnd-button-primary shrink-0 self-start px-4 py-2 text-sm sm:self-auto">
        Create Free Account
      </Link>
    </section>
  )
}

interface FrameProps {
  encounter: Encounter
  guest: GuestSession | null
  actions: BoardActions
  onEdit: (values: NewEncounter) => Promise<unknown>
  onShare: () => void
  onStartOver?: () => void
}

/** The page around the board, the same before and after the encounter is saved. */
function GuestFrame({ encounter, guest, actions, onEdit, onShare, onStartOver }: FrameProps) {
  const [editing, setEditing] = useState(false)
  const playUrl = `${window.location.origin}/play/${encounter.share_token}`

  return (
    <Layout guest title={encounter.title}>
      <title>{guest ? `${encounter.title} · Karsus` : 'Karsus – Free D&D Initiative Tracker'}</title>
      <div className="space-y-6">
        <GuestBanner guest={guest} />
        <PageHeader
          title={encounter.title}
          description={encounter.description}
          actions={
            <>
              {onStartOver && (
                <button type="button" onClick={onStartOver} className="dnd-button-ghost px-3 py-2 text-sm" title="Delete this encounter and start a new one">
                  <RotateCcw className="h-4 w-4" /> Start Over
                </button>
              )}
              <button type="button" onClick={() => setEditing(true)} className="dnd-button-secondary px-4 py-2 text-sm" title="Change the encounter’s name and scene description">
                <Pencil className="h-4 w-4" /> Edit
              </button>
              <button type="button" onClick={onShare} className="dnd-button-secondary px-4 py-2 text-sm" title="Share the player view: a live, read-only link for the table screen or everyone’s phones">
                <Share2 className="h-4 w-4" />
                <span className="sr-only">Share</span>
                {encounter.share_enabled && <span className="h-1.5 w-1.5 rounded-full bg-dnd-jade" aria-label="(on)" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!encounter.share_enabled) actions.updateEncounter({ share_enabled: true })
                  openPlayerWindow(playUrl)
                }}
                disabled={encounter.creatures.length === 0}
                className="dnd-button-primary px-4 py-2 text-sm"
                title="Open what your players see in a new window: put it on a TV or projector"
              >
                <ExternalLink className="h-4 w-4" /> Player View
              </button>
            </>
          }
        />

        <EncounterBoard encounter={encounter} actions={actions} />
      </div>

      <EncounterFormDialog
        open={editing}
        onClose={() => setEditing(false)}
        heading="Edit Encounter"
        nameLabel="Title"
        submitLabel="Save Changes"
        initial={encounter}
        onSubmit={onEdit}
      />
    </Layout>
  )
}

/**
 * Home for anyone without an account: an encounter ready to run. Nothing is
 * stored until the first change, which creates it on the server (so the player
 * view link works on other devices) for 7 days. Signing up or in keeps it.
 */
export default function GuestPage() {
  const { guest, setGuest } = useAuth()
  const qc = useQueryClient()
  const [sharing, setSharing] = useState(false)

  /** The first change saves the encounter. Later calls just return it. */
  async function start(): Promise<string> {
    if (guest) return guest.encounter_id
    const res = await api.post<{ guest: GuestSession; encounter: Encounter }>('guest')
    qc.setQueryData(keys.encounter(res.encounter.id), { ...res.encounter, creatures: res.encounter.creatures.map(withConditions) })
    setGuest(res.guest)
    return res.encounter.id
  }

  const share = () =>
    start()
      .then(() => setSharing(true))
      .catch((e: Error) => toast.error(e.message))

  return guest ? (
    <SavedEncounter guest={guest} sharing={sharing} onShare={share} onCloseShare={() => setSharing(false)} />
  ) : (
    <BlankEncounter start={start} onShare={share} />
  )
}

/** Before anything is saved: the first real change creates the encounter, then applies itself to it. */
function BlankEncounter({ start, onShare }: { start: () => Promise<string>; onShare: () => void }) {
  const qc = useQueryClient()
  const patch = (id: string, fn: (e: Encounter) => Encounter) => qc.setQueryData<Encounter>(keys.encounter(id), (e) => (e ? fn(e) : e))

  async function updateEncounter(changes: EncounterPatch) {
    const id = await start()
    patch(id, (e) => ({ ...e, ...changes }))
    await api.patch(`encounters/${id}`, changes)
  }

  const actions: BoardActions = {
    // Nothing to act on until there are creatures.
    advance: () => {},
    updateCreature: () => {},
    removeCreature: () => {},
    addCreatures: async (creatures) => {
      try {
        const id = await start()
        const added = await api.post<Creature[]>(`encounters/${id}/creatures`, { creatures })
        patch(id, (e) => ({ ...e, creatures: [...e.creatures, ...added.map(withConditions)] }))
      } catch (e) {
        toast.error((e as Error).message)
        throw e
      }
    },
    updateEncounter: (changes) => void updateEncounter(changes).catch((e: Error) => toast.error(e.message)),
  }

  return <GuestFrame encounter={BLANK} guest={null} actions={actions} onEdit={updateEncounter} onShare={onShare} />
}

function SavedEncounter({ guest, sharing, onShare, onCloseShare }: { guest: GuestSession; sharing: boolean; onShare: () => void; onCloseShare: () => void }) {
  const { setGuest } = useAuth()
  const qc = useQueryClient()
  const id = guest.encounter_id
  const { data: encounter, error } = useEncounter(id)
  const m = useEncounterMutations(id)
  const [confirmStartOver, setConfirmStartOver] = useState(false)

  // It ended (seven days passed) or was started over in another tab: begin again with a blank board.
  const gone = error instanceof NotFoundError
  useEffect(() => {
    if (!gone) return
    void api.delete('guest').catch(() => {})
    setGuest(null)
  }, [gone, setGuest])

  if (!encounter) {
    return (
      <Layout guest>
        <div className="flex h-64 items-center justify-center">
          {error && !gone ? (
            <p className="font-body text-dnd-red">{error.message}</p>
          ) : (
            <div className="animate-pulse font-body tracking-widest text-dnd-gold">Loading encounter…</div>
          )}
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
  }
  const playUrl = `${window.location.origin}/play/${encounter.share_token}`

  async function startOver() {
    try {
      await api.delete('guest')
      qc.removeQueries({ queryKey: keys.encounter(id) })
      setConfirmStartOver(false)
      setGuest(null)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <>
      <GuestFrame
        encounter={encounter}
        guest={guest}
        actions={actions}
        onEdit={(v) => m.updateEncounter.mutateAsync(v)}
        onShare={onShare}
        onStartOver={() => setConfirmStartOver(true)}
      />
      <ShareDialog
        open={sharing}
        onClose={onCloseShare}
        url={playUrl}
        enabled={encounter.share_enabled}
        onToggle={(share_enabled) => m.updateEncounter.mutate({ share_enabled })}
        onOpenWindow={() => openPlayerWindow(playUrl)}
      />
      <ConfirmDelete
        open={confirmStartOver}
        onClose={() => setConfirmStartOver(false)}
        title="Start Over"
        confirmLabel="Start Over"
        body="Delete this encounter and start a blank one? Its player view link stops working."
        onConfirm={() => void startOver()}
      />
    </>
  )
}
