import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { LogOut, Pencil, Repeat, Swords, Users } from 'lucide-react'
import ConfirmDelete from '@/components/ui/ConfirmDelete'
import Layout, { PageHeader } from '@/components/ui/Layout'
import Modal from '@/components/ui/Modal'
import { Token } from '@/components/ui/tokens'
import { useAuth } from '@/features/auth/AuthProvider'
import { CharacterPicker } from '@/features/characters/CharacterPicker'
import { CharacterSheetDialog, type CharacterDraft } from '@/features/characters/CharacterSheetDialog'
import { CharacterSheetView } from '@/features/characters/CharacterSheetView'
import { NotFoundError } from '@/features/encounters/queries'
import { useCampaign, useCharacterChoice, useLeave, useUpdateCharacter } from '@/features/player/queries'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/format'
import { uploadImage } from '@/lib/images'
import { classSummary } from '@/lib/sheet'
import type { CharacterChoice } from '@/lib/types'

export default function CampaignPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: campaign, isPending, error } = useCampaign(id)
  const choose = useCharacterChoice(id)
  const update = useUpdateCharacter(id)
  const leave = useLeave('presets', id)
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [leaving, setLeaving] = useState(false)

  if (isPending) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <div className="animate-pulse font-body tracking-widest text-dnd-gold">Opening the campaign…</div>
        </div>
      </Layout>
    )
  }

  if (error || !campaign) {
    return (
      <Layout>
        <div className="py-20 text-center">
          <p className="font-body text-dnd-red">{error instanceof NotFoundError ? 'This campaign is closed.' : (error?.message ?? 'Something went wrong.')}</p>
          {error instanceof NotFoundError && <p className="mt-2 font-ui text-dnd-muted italic">The DM may have hidden it or removed you.</p>}
          <button type="button" onClick={() => navigate('/')} className="dnd-button-secondary mt-4">
            ‹ Back
          </button>
        </div>
      </Layout>
    )
  }

  const mine = campaign.mine
  const others = campaign.party.filter((p) => p.id !== mine?.id)

  async function pick(choice: CharacterChoice) {
    await choose.mutateAsync(choice)
    setSwitching(false)
  }
  const saveSheet = ({ initiative: _unused, ...patch }: CharacterDraft) => update.mutateAsync({ cid: mine!.id, patch })

  return (
    <Layout title={campaign.name}>
      <title>{`${campaign.name} · Karsus`}</title>
      {campaign.background_url && (
        <div className="pointer-events-none fixed inset-0 z-0 bg-dnd-black">
          <img src={campaign.background_url} alt="" className="h-full w-full object-cover opacity-[0.18]" />
          <div className="absolute inset-0 bg-gradient-to-b from-dnd-black/50 via-transparent to-dnd-black/70" />
        </div>
      )}

      <div className="relative z-10 space-y-6">
        <PageHeader
          back={{ to: '/', label: 'Back' }}
          eyebrow={`Campaign · DM ${campaign.dm_name}`}
          title={campaign.name}
          description={campaign.description}
          actions={
            <button type="button" onClick={() => setLeaving(true)} className="dnd-button-ghost px-3 py-2 text-sm hover:text-dnd-red">
              <LogOut className="h-4 w-4" /> Leave Campaign
            </button>
          }
        />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {mine ? (
              <CharacterSheetView
                character={mine}
                onSlots={(slots) => mine.sheet && update.mutate({ cid: mine.id, patch: { sheet: { ...mine.sheet, ...slots } } })}
                actions={
                  <>
                    <button type="button" className="dnd-button-primary px-4 py-2 text-sm" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4" /> Edit Sheet
                    </button>
                    <button type="button" className="dnd-button-secondary px-4 py-2 text-sm" onClick={() => setSwitching(true)}>
                      <Repeat className="h-4 w-4" /> Switch
                    </button>
                  </>
                }
              />
            ) : (
              <section aria-labelledby="pick" className="space-y-4">
                <div className="dnd-card p-5">
                  <h2 id="pick" className="font-body text-lg tracking-widest text-dnd-gold uppercase">
                    Choose your character
                  </h2>
                  <p className="mt-1 font-ui text-dnd-muted italic">Pick one of the characters {campaign.dm_name} prepared, or make your own.</p>
                </div>
                <CharacterPicker
                  characters={campaign.available}
                  pending={choose.isPending}
                  onClaim={(cid) => void pick({ claim: cid }).catch(() => {})}
                  onCreate={() => setCreating(true)}
                />
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <section aria-labelledby="fights" className="dnd-card p-5">
              <h2 id="fights" className="mb-3 flex items-center gap-2 font-body text-sm tracking-widest text-dnd-parchment uppercase">
                <Swords className="h-4 w-4 text-dnd-crimson" /> Encounters
              </h2>
              {campaign.encounters.length === 0 ? (
                <p className="font-ui text-sm text-dnd-muted italic">When {campaign.dm_name} starts a fight for this campaign, it appears here.</p>
              ) : (
                <ul className="space-y-1.5">
                  {/* Live first: the fight the DM is running right now. */}
                  {[...campaign.encounters].sort((a, b) => Number(b.live) - Number(a.live)).map((e) => (
                    <li key={e.id}>
                      <Link
                        to={`/encounters/${e.id}/view`}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:border-dnd-gold/50',
                          e.live ? 'border-dnd-jade/60 bg-dnd-teal/15 shadow-glow-jade' : 'border-dnd-border/40 bg-dnd-dark/60',
                        )}
                      >
                        <span className={e.live || e.started ? 'h-2 w-2 animate-pulse rounded-full bg-dnd-jade' : 'h-2 w-2 rounded-full bg-dnd-border'} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-body text-sm text-dnd-parchment group-hover:text-dnd-gold">{e.title}</span>
                          <span className="font-ui text-xs text-dnd-muted italic">
                            {e.live ? 'Live now' : e.started ? `Round ${e.round}, in progress` : `Edited ${timeAgo(e.updated_at)}`}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="party" className="dnd-card p-5">
              <h2 id="party" className="mb-3 flex items-center gap-2 font-body text-sm tracking-widest text-dnd-parchment uppercase">
                <Users className="h-4 w-4 text-dnd-jade" /> The Party
              </h2>
              {others.length === 0 ? (
                <p className="font-ui text-sm text-dnd-muted italic">No one else yet.</p>
              ) : (
                <ul className="space-y-3">
                  {others.map((p) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <Token name={p.name} src={p.image_url} isPlayer size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-body text-sm text-dnd-parchment">{p.name}</span>
                        <span className="block truncate font-ui text-xs text-dnd-muted italic">
                          {[classSummary(p.classes) || null, p.player_name ? `played by ${p.player_name}` : 'nobody plays them yet'].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>

      {mine && (
        <CharacterSheetDialog
          open={editing}
          onClose={() => setEditing(false)}
          title={`Edit ${mine.name}`}
          submitLabel="Save Sheet"
          initial={mine}
          upload={uploadImage}
          onSubmit={saveSheet}
        />
      )}
      <CharacterSheetDialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Your Character"
        submitLabel="Play This Character"
        upload={uploadImage}
        onSubmit={(draft) => pick({ create: { ...draft, is_player: true } })}
      />
      <Modal open={switching} onClose={() => setSwitching(false)} title="Switch Character" description={mine ? `${mine.name} stays in the campaign, free for someone else to pick.` : undefined} size="xl">
        <div className="p-6">
          <CharacterPicker
            characters={campaign.available}
            pending={choose.isPending}
            claimLabel="Switch to"
            onClaim={(cid) => void pick({ claim: cid }).catch(() => {})}
            onCreate={() => {
              setSwitching(false)
              setCreating(true)
            }}
          />
        </div>
      </Modal>
      <ConfirmDelete
        open={leaving}
        onClose={() => setLeaving(false)}
        title="Leave Campaign"
        confirmLabel="Leave"
        loading={leave.isPending}
        body={`${mine ? `${mine.name} stays behind for someone else to play. ` : ''}You’ll need a new invite from ${campaign.dm_name} to come back.`}
        onConfirm={async () => {
          try {
            await leave.mutateAsync(user!.id)
            navigate('/', { replace: true })
          } catch {
            setLeaving(false)
          }
        }}
      />
    </Layout>
  )
}
