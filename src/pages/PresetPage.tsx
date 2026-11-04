import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Copy, Eye, EyeOff, Heart, Pencil, Play, Plus, ScrollText, Shield, Trash2, Users, Zap } from 'lucide-react'
import { toast } from 'sonner'
import Layout, { PageHeader } from '@/components/ui/Layout'
import { Token } from '@/components/ui/tokens'
import { CharacterSheetDialog } from '@/features/characters/CharacterSheetDialog'
import { CreatureFormDialog, type CreatureFormTarget } from '@/features/combat/CreatureFormDialog'
import { EncounterFormDialog } from '@/features/encounters/EncounterFormDialog'
import { NotFoundError } from '@/features/encounters/queries'
import { MembersPanel } from '@/features/members/MembersPanel'
import { presetKeys, useLaunchPreset, usePreset, usePresetMutations } from '@/features/presets/queries'
import { cn } from '@/lib/cn'
import { copyName, duplicateCreature, restorable } from '@/lib/combat'
import { formatModifier } from '@/lib/dice'
import { uploadImage } from '@/lib/images'
import { classSummary } from '@/lib/sheet'
import type { Creature } from '@/lib/types'

export default function PresetPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: preset, isPending, error } = usePreset(id)
  const m = usePresetMutations(id)
  const launch = useLaunchPreset()
  const [editing, setEditing] = useState(false)
  const [formTarget, setFormTarget] = useState<CreatureFormTarget | null>(null)
  const [sheetFor, setSheetFor] = useState<Creature | null>(null)

  if (isPending) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <div className="animate-pulse font-body tracking-widest text-dnd-gold">Loading preset…</div>
        </div>
      </Layout>
    )
  }

  if (error || !preset) {
    return (
      <Layout>
        <div className="py-20 text-center">
          <p className="font-body text-dnd-red">{error instanceof NotFoundError ? 'Preset not found.' : (error?.message ?? 'Something went wrong.')}</p>
          <button type="button" onClick={() => navigate('/')} className="dnd-button-secondary mt-4">
            ‹ Back
          </button>
        </div>
      </Layout>
    )
  }

  // Party first, then monsters, alphabetically: presets have no turn order yet.
  const sorted = [...preset.creatures].sort((a, b) => Number(b.is_player) - Number(a.is_player) || a.name.localeCompare(b.name))
  const playerName = (userId: string | null) => (userId ? preset.members.find((x) => x.user_id === userId)?.username : undefined)
  const pcs = sorted.filter((c) => c.is_player).length

  return (
    <Layout title={preset.name}>
      <title>{`${preset.name} · Karsus`}</title>
      {preset.background_url && (
        <div className="pointer-events-none fixed inset-0 z-0 opacity-10">
          <img src={preset.background_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="relative z-10 space-y-6">
        <PageHeader
          back={{ to: '/', label: 'Back' }}
          eyebrow={preset.members.length ? 'Campaign' : 'Preset'}
          title={preset.name}
          description={preset.description}
          actions={
            <>
              <button type="button" onClick={() => setEditing(true)} className="dnd-button-secondary px-4 py-2 text-sm">
                <Pencil className="h-4 w-4" /> Edit Preset
              </button>
              <button type="button" onClick={() => m.update.mutate({ hidden: !preset.hidden })} className="dnd-button-secondary px-4 py-2 text-sm">
                {preset.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {preset.hidden ? 'Show to Players' : 'Hide from Players'}
              </button>
              <button
                type="button"
                onClick={async () => navigate(`/encounters/${await launch.mutateAsync(id)}`)}
                disabled={launch.isPending || preset.creatures.length === 0}
                className="dnd-button-primary px-4 py-2 text-sm"
              >
                <Play className="h-4 w-4" /> {launch.isPending ? 'Launching…' : 'Launch Encounter'}
              </button>
            </>
          }
        />

        {preset.hidden && (
          <p className="flex items-center gap-2 rounded-lg border border-purple-500/40 bg-purple-950/40 px-4 py-2 font-ui text-sm text-purple-200 italic">
            <EyeOff className="h-4 w-4 shrink-0" /> Hidden: players can’t open this campaign or any encounter launched from it.
          </p>
        )}

        <div className="dnd-card flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex gap-8">
            <div>
              <p className="font-body text-xs tracking-widest text-dnd-muted uppercase">Template Creatures</p>
              <p className="font-display text-2xl text-dnd-gold">{sorted.length}</p>
            </div>
            <div>
              <p className="font-body text-xs tracking-widest text-dnd-muted uppercase">Players</p>
              <p className="font-display text-2xl text-dnd-jade">{preset.members.filter((x) => x.role === 'player').length}</p>
            </div>
          </div>
          <p className="max-w-md font-ui text-sm text-dnd-muted italic">
            Launching creates a new encounter with all these creatures: monsters roll initiative, the party keeps theirs. {pcs > 0 && 'Players see it unless you hide it.'}
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-labelledby="creatures">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="creatures" className="font-body text-lg tracking-widest text-dnd-parchment uppercase">
                Creatures <span className="text-sm text-dnd-muted">({sorted.length})</span>
              </h2>
              <button type="button" onClick={() => setFormTarget({ mode: 'add' })} className="dnd-button-secondary px-3 py-1.5 text-sm">
                <Plus className="h-4 w-4" /> Add Creature
              </button>
            </div>

            {sorted.length === 0 ? (
              <div className="dnd-card p-10 text-center">
                <p className="font-ui text-dnd-muted italic">No creatures yet. Build your template, or invite players to make their own characters!</p>
                <button type="button" onClick={() => setFormTarget({ mode: 'add' })} className="dnd-button-secondary mt-4 text-sm">
                  <Plus className="h-4 w-4" /> Add Creature
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {sorted.map((c) => (
                  <CreatureCard
                    key={c.id}
                    creature={c}
                    playedBy={playerName(c.player_id)}
                    onEdit={() => setFormTarget({ mode: 'edit', creature: c })}
                    onSheet={() => setSheetFor(c)}
                    onToggleHidden={() => m.updateCreature.mutate({ cid: c.id, patch: { hidden: !c.hidden } })}
                    onDelete={() => {
                      // No confirmation: the toast offers to put it back.
                      m.removeCreature.mutate(c.id)
                      const player = playerName(c.player_id)
                      toast(`${c.name} removed`, {
                        description: player ? `${player} will need to pick another character.` : undefined,
                        action: { label: 'Undo', onClick: () => void m.addCreatures.mutateAsync([restorable(c)]).catch(() => {}) },
                      })
                    }}
                    onDuplicate={async () => {
                      const { rename, copy } = copyName(c.name, preset.creatures.map((x) => x.name))
                      if (rename) m.updateCreature.mutate({ cid: c.id, patch: { name: rename } })
                      try {
                        await m.addCreatures.mutateAsync([duplicateCreature(c, copy)])
                        toast.success(`Added ${copy}`)
                      } catch {
                        // The mutation already reported it.
                      }
                    }}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="players" className="dnd-card p-5">
            <h2 id="players" className="mb-4 flex items-center gap-2 font-body text-lg tracking-widest text-dnd-parchment uppercase">
              <Users className="h-5 w-5 text-dnd-jade" /> Players
            </h2>
            <MembersPanel
              kind="campaign"
              base={`presets/${id}`}
              queryKey={presetKeys.preset(id)}
              members={preset.members}
              invites={preset.invites}
              creatures={preset.creatures}
            />
          </section>
        </div>
      </div>

      <EncounterFormDialog
        open={editing}
        onClose={() => setEditing(false)}
        heading="Edit Preset"
        nameLabel="Preset Name"
        submitLabel="Save Changes"
        initial={{ title: preset.name, description: preset.description, background_url: preset.background_url }}
        upload={uploadImage}
        onSubmit={({ title, ...rest }) => m.update.mutateAsync({ name: title, ...rest })}
      />
      <CreatureFormDialog
        target={formTarget}
        context="preset"
        existingNames={preset.creatures.map((c) => c.name)}
        onClose={() => setFormTarget(null)}
        onAdd={(creatures) => m.addCreatures.mutateAsync(creatures)}
        onEdit={(cid, patch) => m.updateCreature.mutate({ cid, patch })}
        upload={uploadImage}
      />
      <CharacterSheetDialog
        open={sheetFor !== null}
        onClose={() => setSheetFor(null)}
        title={sheetFor ? `${sheetFor.name}’s Sheet` : ''}
        submitLabel="Save Sheet"
        initial={sheetFor}
        upload={uploadImage}
        onSubmit={({ initiative: _unused, ...patch }) => m.updateCreature.mutateAsync({ cid: sheetFor!.id, patch })}
      />
    </Layout>
  )
}

interface CreatureCardProps {
  creature: Creature
  playedBy?: string
  onEdit: () => void
  onSheet: () => void
  onToggleHidden: () => void
  onDuplicate: () => void
  onDelete: () => void
}

/** A preset's creature: token, stats, who plays it. Tools appear on hover (always on a phone). */
function CreatureCard({ creature: c, playedBy, onEdit, onSheet, onToggleHidden, onDuplicate, onDelete }: CreatureCardProps) {
  const btn = 'rounded-lg p-1.5 text-dnd-muted transition-colors hover:bg-dnd-card'
  return (
    <li className={cn('dnd-card group relative overflow-hidden transition-all duration-300', c.hidden && 'border-dashed opacity-70')}>
      <div className="flex items-center gap-3 p-3">
        <Token name={c.name} src={c.image_url} isPlayer={c.is_player} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-body text-sm font-medium text-dnd-parchment">{c.name}</span>
            {c.is_player && <span className="rounded border border-dnd-gold/40 px-1.5 text-[10px] tracking-widest text-dnd-gold uppercase">PC</span>}
            {c.hidden && <span className="rounded border border-purple-500/50 px-1.5 text-[10px] tracking-widest text-purple-300 uppercase">Hidden</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-dnd-muted">
            {c.sheet && c.sheet.classes.length > 0 && <span>{classSummary(c.sheet.classes)}</span>}
            <span className="flex items-center gap-0.5" title="Initiative bonus">
              <Zap className="h-3 w-3 text-dnd-amber" /> {formatModifier(c.initiative_bonus)}
            </span>
            {c.max_hp !== null && (
              <span className="flex items-center gap-0.5" title="Max HP">
                <Heart className="h-3 w-3 text-red-400" /> {c.max_hp}
              </span>
            )}
            {c.armor_class !== null && (
              <span className="flex items-center gap-0.5" title="Armor class">
                <Shield className="h-3 w-3 text-blue-400" /> {c.armor_class}
              </span>
            )}
          </div>
          {c.is_player && <p className="mt-0.5 font-ui text-[11px] text-dnd-jade/80 italic">{playedBy ? `Played by ${playedBy}` : 'Nobody plays them yet'}</p>}
          {c.notes && <p className="mt-0.5 truncate font-ui text-[11px] text-dnd-muted/70 italic">{c.notes}</p>}
        </div>

        <div className="flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
          <button type="button" onClick={onToggleHidden} className={cn(btn, 'hover:text-purple-300')} aria-label={c.hidden ? `Show ${c.name} to players` : `Hide ${c.name} from players`} title={c.hidden ? 'Show to players' : 'Hide from players'}>
            {c.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          {c.is_player && (
            <button type="button" onClick={onSheet} className={cn(btn, 'hover:text-dnd-jade')} aria-label={`Character sheet for ${c.name}`} title="Character sheet">
              <ScrollText className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={onDuplicate} className={cn(btn, 'hover:text-dnd-jade')} aria-label={`Duplicate ${c.name}`} title="Duplicate">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onEdit} className={cn(btn, 'hover:text-dnd-gold')} aria-label={`Edit ${c.name}`} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} className={cn(btn, 'hover:text-dnd-red')} aria-label={`Remove ${c.name}`} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  )
}
