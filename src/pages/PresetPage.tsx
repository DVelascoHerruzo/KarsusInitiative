import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Heart, Pencil, Play, Plus, Shield, Trash2, Users, Zap } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Avatar, EmptyState, PageLoader } from '@/components/ui/display'
import { CreatureFormDialog, type CreatureFormTarget } from '@/features/combat/CreatureFormDialog'
import { EncounterFormDialog } from '@/features/encounters/EncounterFormDialog'
import { NotFoundError } from '@/features/encounters/queries'
import { SceneHeader } from '@/features/encounters/SceneHeader'
import { useLaunchPreset, usePreset, usePresetMutations } from '@/features/presets/queries'
import { formatModifier } from '@/lib/dice'
import { uploadImage } from '@/lib/images'
import type { Creature } from '@/lib/types'

export default function PresetPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: preset, isPending, error } = usePreset(id)
  const m = usePresetMutations(id)
  const launch = useLaunchPreset()
  const [editing, setEditing] = useState(false)
  const [formTarget, setFormTarget] = useState<CreatureFormTarget | null>(null)
  const [removing, setRemoving] = useState<Creature | null>(null)

  if (isPending) return <AppShell><PageLoader label="Loading preset" /></AppShell>
  if (error || !preset) {
    return (
      <AppShell>
        <div className="border-l-4 border-accent py-6 pl-6">
          <h1 className="display text-4xl text-vellum">{error instanceof NotFoundError ? 'Preset not found' : 'Something went wrong'}</h1>
          <ButtonLink to="/" className="mt-6">Back</ButtonLink>
        </div>
      </AppShell>
    )
  }

  // Party first, then monsters, alphabetically — presets have no turn order yet.
  const sorted = [...preset.creatures].sort((a, b) => Number(b.is_player) - Number(a.is_player) || a.name.localeCompare(b.name))

  return (
    <AppShell>
      <title>{`${preset.name} · Karsus`}</title>
      <SceneHeader
        title={preset.name}
        description={preset.description}
        background={preset.background_url}
        backTo="/"
        backLabel="Your table"
        actions={
          <>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Button
              variant="primary"
              disabled={launch.isPending || preset.creatures.length === 0}
              onClick={async () => navigate(`/encounters/${await launch.mutateAsync(id)}`)}
            >
              <Play /> Launch encounter
            </Button>
          </>
        }
      />

      <section aria-labelledby="roster">
        <div className="mb-4 flex items-end gap-3 border-b border-line pb-3">
          <h2 id="roster" className="display text-3xl text-vellum">Roster</h2>
          <span className="tabular cmd pb-0.5 text-sm text-ink-faint">{sorted.length}</span>
          <div className="flex-1" />
          <Button size="sm" onClick={() => setFormTarget({ mode: 'add' })}>
            <Plus /> Add creature
          </Button>
        </div>

        {sorted.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="An empty roster"
            body="Add your party or a band of monsters. When you launch, monsters roll initiative automatically."
            action={<Button variant="primary" onClick={() => setFormTarget({ mode: 'add' })}><Plus /> Add creature</Button>}
          />
        ) : (
          <ul className="grid gap-px bg-line sm:grid-cols-2">
            {sorted.map((c) => (
              <li key={c.id} className="flex items-center gap-3 bg-panel p-3">
                <Avatar name={c.name} src={c.image_url} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2">
                    <span className="display truncate text-2xl text-ink">{c.name}</span>
                    {c.is_player && <span className="cmd shrink-0 text-xs text-ink-faint">PC</span>}
                  </p>
                  <p className="tabular cmd mt-1 flex gap-4 text-xs text-ink-muted">
                    <span className="flex items-center gap-1" title="Initiative bonus"><Zap className="size-3" />{formatModifier(c.initiative_bonus)}</span>
                    {c.max_hp !== null && <span className="flex items-center gap-1" title="Max HP"><Heart className="size-3" />{c.max_hp}</span>}
                    {c.armor_class !== null && <span className="flex items-center gap-1" title="Armor class"><Shield className="size-3" />{c.armor_class}</span>}
                  </p>
                </div>
                <IconButton label={`Edit ${c.name}`} size="icon-sm" onClick={() => setFormTarget({ mode: 'edit', creature: c })}>
                  <Pencil />
                </IconButton>
                <IconButton label={`Remove ${c.name}`} size="icon-sm" onClick={() => setRemoving(c)} className="hover:text-signal">
                  <Trash2 />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EncounterFormDialog
        open={editing}
        onClose={() => setEditing(false)}
        heading="Edit preset"
        nameLabel="Preset name"
        submitLabel="Save"
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
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? ''}?`}
        body="They’ll be removed from this preset. Encounters already launched from it aren’t affected."
        confirmLabel="Remove"
        pending={m.removeCreature.isPending}
        onConfirm={async () => {
          if (removing) await m.removeCreature.mutateAsync(removing.id)
          setRemoving(null)
        }}
      />
    </AppShell>
  )
}
