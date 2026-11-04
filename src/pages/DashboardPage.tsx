import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, FolderInput, Pencil, Play, Plus, Swords, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CardGrid, CardSkeletons, EmptyCard, EncounterGroups, Hero, SceneCard, SectionHeading } from '@/components/ui/Cards'
import ConfirmDelete from '@/components/ui/ConfirmDelete'
import Layout from '@/components/ui/Layout'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/features/auth/AuthProvider'
import { EncounterFormDialog } from '@/features/encounters/EncounterFormDialog'
import { FolderSelect } from '@/features/encounters/FolderSelect'
import { keys, useCreateEncounter, useDeleteEncounter, useEncounterList } from '@/features/encounters/queries'
import { presetKeys, useCreatePreset, useDeletePreset, useLaunchPreset, usePresetList } from '@/features/presets/queries'
import { api } from '@/lib/api'
import { groupEncounters } from '@/lib/folders'
import { uploadImage } from '@/lib/images'
import type { EncounterSummary, NewEncounter, PresetSummary } from '@/lib/types'

type Editing = { kind: 'encounter'; item?: EncounterSummary } | { kind: 'preset'; item?: PresetSummary }
type Pending = { kind: 'encounter' | 'preset'; id: string; name: string }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const encounters = useEncounterList()
  const presets = usePresetList()
  const createEncounter = useCreateEncounter()
  const createPreset = useCreatePreset()
  const deleteEncounter = useDeleteEncounter()
  const deletePreset = useDeletePreset()
  const launch = useLaunchPreset()

  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Pending | null>(null)
  const [filing, setFiling] = useState<EncounterSummary | null>(null)

  const rename = useMutation({
    mutationFn: ({ kind, id, values }: { kind: 'encounter' | 'preset'; id: string; values: NewEncounter }) =>
      kind === 'encounter' ? api.patch(`encounters/${id}`, values) : api.patch(`presets/${id}`, { name: values.title, description: values.description, background_url: values.background_url }),
    onSuccess: (_, { kind }) => {
      void qc.invalidateQueries({ queryKey: kind === 'encounter' ? keys.encounters : presetKeys.presets })
      toast.success(kind === 'encounter' ? 'Encounter updated' : 'Preset updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Things shared with you say so; only what you own can be deleted.
  const tags = (ownerId: string, hidden: boolean, members: number) =>
    [ownerId !== user?.id && 'Co-DM', hidden && 'Hidden', ownerId === user?.id && members > 0 && plural(members, 'member')].filter((t): t is string => Boolean(t))

  const toolBtn = 'rounded bg-dnd-black/70 p-1.5 text-dnd-muted backdrop-blur transition-colors'
  const tools = (onEdit: () => void, pending: Pending, ownerId: string, onFile?: () => void) => (
    <>
      {onFile && (
        <button type="button" onClick={onFile} className={`${toolBtn} hover:text-dnd-gold`} aria-label={`Move ${pending.name} to a folder`} title="Move to folder">
          <FolderInput className="h-3.5 w-3.5" />
        </button>
      )}
      <button type="button" onClick={onEdit} className={`${toolBtn} hover:text-dnd-gold`} aria-label={`Edit ${pending.name}`} title="Edit">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {ownerId === user?.id && (
        <button type="button" onClick={() => setDeleting(pending)} className={`${toolBtn} hover:text-dnd-red`} aria-label={`Delete ${pending.name}`} title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  )

  async function submit(values: NewEncounter) {
    if (!editing) return
    if (editing.item) return rename.mutateAsync({ kind: editing.kind, id: editing.item.id, values })
    if (editing.kind === 'encounter') navigate(`/encounters/${(await createEncounter.mutateAsync(values)).id}`)
    else navigate(`/presets/${(await createPreset.mutateAsync({ name: values.title, description: values.description, background_url: values.background_url })).id}`)
  }

  const editingInitial =
    editing?.kind === 'encounter' && editing.item
      ? editing.item
      : editing?.kind === 'preset' && editing.item
        ? { title: editing.item.name, description: editing.item.description, background_url: editing.item.background_url }
        : undefined

  return (
    <Layout>
      <title>Battle Command · Karsus</title>
      <div className="space-y-10">
        <Hero eyebrow="Battle Command" title="KARSUS INITIATIVE" tagline="Lead every charge. Track every turn." />

        {/* ── Encounters ─────────────────────────────────────────── */}
        <section aria-label="Encounters">
          <SectionHeading
            icon={<Swords className="h-5 w-5 text-dnd-crimson" />}
            title="Encounters"
            count={encounters.data?.length}
            action={
              <button type="button" onClick={() => setEditing({ kind: 'encounter' })} className="dnd-button-primary px-4 py-2">
                <Plus className="h-4 w-4" /> New Encounter
              </button>
            }
          />
          {encounters.isPending ? (
            <CardSkeletons />
          ) : encounters.error ? (
            <EmptyCard icon={<Swords className="h-10 w-10" />} text={`Couldn’t load encounters: ${encounters.error.message}`} />
          ) : encounters.data.length === 0 ? (
            <EmptyCard
              icon={<Swords className="h-10 w-10" />}
              text="No encounters yet. Create your first battle!"
              action={
                <button type="button" onClick={() => setEditing({ kind: 'encounter' })} className="dnd-button-secondary">
                  <Plus className="h-4 w-4" /> Create Encounter
                </button>
              }
            />
          ) : (
            <EncounterGroups
              groups={groupEncounters(encounters.data, (presets.data ?? []).map((p) => ({ id: p.id, name: p.name })))}
              render={(e) => (
                <SceneCard
                  key={e.id}
                  to={`/encounters/${e.id}`}
                  title={e.title}
                  description={e.description}
                  background={e.background_url}
                  strip={`${e.active_creature_id ? `ROUND ${e.round} · IN PROGRESS` : 'NOT STARTED'} · ${plural(e.creatures.length, 'CREATURE').toUpperCase()}`}
                  live={e.active_creature_id !== null}
                  creatures={e.creatures}
                  tags={[...(e.live ? ['Live'] : []), ...tags(e.owner_id, e.hidden, e.members)]}
                  tools={tools(() => setEditing({ kind: 'encounter', item: e }), { kind: 'encounter', id: e.id, name: e.title }, e.owner_id, () => setFiling(e))}
                />
              )}
            />
          )}
        </section>

        {/* ── Presets ─────────────────────────────────────────────── */}
        <section aria-label="Presets">
          <SectionHeading
            icon={<BookOpen className="h-5 w-5 text-dnd-gold" />}
            title="Presets"
            count={presets.data?.length}
            action={
              <button type="button" onClick={() => setEditing({ kind: 'preset' })} className="dnd-button-secondary px-4 py-2">
                <Plus className="h-4 w-4" /> New Preset
              </button>
            }
          />
          <p className="-mt-2 mb-4 max-w-3xl font-ui text-sm text-dnd-muted italic">
            Your party, a recurring villain, a random-encounter table. Invite players to a preset and it becomes a campaign: they pick their characters, and
            every encounter you launch from it shows up for them.
          </p>
          {presets.isPending ? (
            <CardSkeletons />
          ) : presets.error ? (
            <EmptyCard icon={<BookOpen className="h-10 w-10" />} text={`Couldn’t load presets: ${presets.error.message}`} />
          ) : presets.data.length === 0 ? (
            <EmptyCard
              icon={<BookOpen className="h-10 w-10" />}
              text="No presets yet. Save your party once and drop them into every fight!"
              action={
                <button type="button" onClick={() => setEditing({ kind: 'preset' })} className="dnd-button-secondary">
                  <Plus className="h-4 w-4" /> Create Preset
                </button>
              }
            />
          ) : (
            <CardGrid>
              {presets.data.map((p) => (
                <SceneCard
                  key={p.id}
                  to={`/presets/${p.id}`}
                  glow="gold"
                  title={p.name}
                  description={p.description}
                  background={p.background_url}
                  strip={plural(p.creatures.length, 'creature').toUpperCase()}
                  creatures={p.creatures}
                  tags={tags(p.owner_id, p.hidden, p.members)}
                  tools={tools(() => setEditing({ kind: 'preset', item: p }), { kind: 'preset', id: p.id, name: p.name }, p.owner_id)}
                  action={
                    <button
                      type="button"
                      disabled={launch.isPending || p.creatures.length === 0}
                      onClick={async () => navigate(`/encounters/${await launch.mutateAsync(p.id)}`)}
                      className="flex items-center gap-1.5 rounded-lg border border-dnd-gold/40 px-3 py-1.5 font-body text-xs tracking-widest text-dnd-gold transition-colors hover:bg-dnd-gold/10 disabled:opacity-40"
                    >
                      <Play className="h-3 w-3" /> Launch
                    </button>
                  }
                />
              ))}
            </CardGrid>
          )}
        </section>
      </div>

      <EncounterFormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        heading={`${editing?.item ? 'Edit' : 'New'} ${editing?.kind === 'preset' ? 'Preset' : 'Encounter'}`}
        nameLabel={editing?.kind === 'preset' ? 'Preset Name' : 'Title'}
        placeholder={editing?.kind === 'preset' ? 'Goblin Ambush' : 'The Final Showdown'}
        submitLabel={editing?.item ? 'Save Changes' : editing?.kind === 'preset' ? 'Create Preset' : 'Create Encounter'}
        initial={editingInitial}
        upload={uploadImage}
        onSubmit={submit}
      />
      <Modal open={filing !== null} onClose={() => setFiling(null)} title="Move to Folder" size="sm">
        {filing && (
          <div className="p-6">
            <FolderSelect encounterId={filing.id} ownerId={filing.owner_id} value={encounters.data?.find((x) => x.id === filing.id)?.campaign_id ?? null} />
          </div>
        )}
      </Modal>
      <ConfirmDelete
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        name={deleting?.name}
        loading={deleteEncounter.isPending || deletePreset.isPending}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await (deleting.kind === 'encounter' ? deleteEncounter : deletePreset).mutateAsync(deleting.id)
            toast.success(deleting.kind === 'encounter' ? 'Encounter deleted' : 'Preset deleted')
          } catch {
            // The mutation already reported the error.
          }
          setDeleting(null)
        }}
      />
    </Layout>
  )
}
