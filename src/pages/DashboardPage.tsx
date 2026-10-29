import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { BookMarked, Play, Plus, Swords, Trash2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Avatar, EmptyState, MonogramPlate, SLANT } from '@/components/ui/display'
import { useAuth } from '@/features/auth/AuthProvider'
import { EncounterFormDialog } from '@/features/encounters/EncounterFormDialog'
import { useCreateEncounter, useDeleteEncounter, useEncounterList } from '@/features/encounters/queries'
import { useCreatePreset, useDeletePreset, useLaunchPreset, usePresetList } from '@/features/presets/queries'
import { timeAgo } from '@/lib/format'
import { uploadImage } from '@/lib/images'
import { cn } from '@/lib/cn'

type Tab = 'encounters' | 'presets'
type Pending = { kind: 'encounter' | 'preset'; id: string; name: string }

export default function DashboardPage() {
  const { displayName } = useAuth()
  const navigate = useNavigate()
  const encounters = useEncounterList()
  const presets = usePresetList()
  const createEncounter = useCreateEncounter()
  const createPreset = useCreatePreset()
  const deleteEncounter = useDeleteEncounter()
  const deletePreset = useDeletePreset()
  const launch = useLaunchPreset()

  const [tab, setTab] = useState<Tab>('encounters')
  const [creating, setCreating] = useState<'encounter' | 'preset' | null>(null)
  const [deleting, setDeleting] = useState<Pending | null>(null)

  return (
    <AppShell>
      <title>Your table · Karsus</title>
      <div className="mb-12 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="cmd text-ink-muted">Welcome back,</p>
          <h1 className="display mt-2 truncate pr-2 text-4xl leading-[1.25] text-vellum sm:text-6xl">{displayName}</h1>
        </div>
        <Button onClick={() => setCreating('preset')}>
          <BookMarked /> New preset
        </Button>
        <Button variant="primary" onClick={() => setCreating('encounter')}>
          <Plus /> New encounter
        </Button>
      </div>

      <div role="tablist" aria-label="Your table" className="flex items-end gap-8 border-b border-line">
        <TabButton id="encounters" current={tab} onSelect={setTab} count={encounters.data?.length}>
          Encounters
        </TabButton>
        <TabButton id="presets" current={tab} onSelect={setTab} count={presets.data?.length}>
          Presets
        </TabButton>
      </div>

      {tab === 'encounters' ? (
        <TabPanel id="encounters" loading={encounters.isPending} error={encounters.error}>
          {encounters.data?.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={<Swords />}
              title="No encounters yet"
              body="An encounter is one fight: its combatants, turn order and scene."
              action={
                <Button variant="primary" onClick={() => setCreating('encounter')}>
                  <Plus /> Create your first
                </Button>
              }
            />
          ) : (
            <ul>
              {encounters.data?.map((e) => (
                <LineupRow
                  key={e.id}
                  to={`/encounters/${e.id}`}
                  title={e.title}
                  description={e.description}
                  background={e.background_url}
                  creatures={e.creatures}
                  status={e.active_creature_id ? `Round ${e.round}, in progress` : 'Not started'}
                  live={e.active_creature_id !== null}
                  updated={e.updated_at}
                  onDelete={() => setDeleting({ kind: 'encounter', id: e.id, name: e.title })}
                />
              ))}
            </ul>
          )}
        </TabPanel>
      ) : (
        <TabPanel id="presets" loading={presets.isPending} error={presets.error}>
          <p className="max-w-2xl py-4 text-sm text-ink-muted">
            Reusable line-ups: your party, a recurring villain, a random-encounter table. Launching one rolls fresh initiative for the monsters.
          </p>
          {presets.data?.length === 0 ? (
            <EmptyState
              icon={<BookMarked />}
              title="No presets yet"
              body="Save your party once and drop them into every new fight."
              action={<Button onClick={() => setCreating('preset')}>New preset</Button>}
            />
          ) : (
            <ul className="border-t border-line">
              {presets.data?.map((p) => (
                <LineupRow
                  key={p.id}
                  to={`/presets/${p.id}`}
                  title={p.name}
                  description={p.description}
                  background={p.background_url}
                  creatures={p.creatures}
                  status={`${p.creatures.length} creature${p.creatures.length === 1 ? '' : 's'}`}
                  updated={p.updated_at}
                  onDelete={() => setDeleting({ kind: 'preset', id: p.id, name: p.name })}
                  action={
                    <Button
                      size="sm"
                      variant="accent"
                      disabled={launch.isPending || p.creatures.length === 0}
                      onClick={async () => navigate(`/encounters/${await launch.mutateAsync(p.id)}`)}
                    >
                      <Play /> Launch
                    </Button>
                  }
                />
              ))}
            </ul>
          )}
        </TabPanel>
      )}

      <EncounterFormDialog
        open={creating === 'encounter'}
        onClose={() => setCreating(null)}
        heading="New encounter"
        nameLabel="Encounter name"
        submitLabel="Create encounter"
        upload={uploadImage}
        onSubmit={async (v) => navigate(`/encounters/${(await createEncounter.mutateAsync(v)).id}`)}
      />
      <EncounterFormDialog
        open={creating === 'preset'}
        onClose={() => setCreating(null)}
        heading="New preset"
        nameLabel="Preset name"
        submitLabel="Create preset"
        upload={uploadImage}
        onSubmit={async ({ title, ...rest }) => navigate(`/presets/${(await createPreset.mutateAsync({ name: title, ...rest })).id}`)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}?`}
        body={`This permanently deletes the ${deleting?.kind} and all its creatures.`}
        pending={deleteEncounter.isPending || deletePreset.isPending}
        onConfirm={async () => {
          if (!deleting) return
          await (deleting.kind === 'encounter' ? deleteEncounter : deletePreset).mutateAsync(deleting.id)
          setDeleting(null)
        }}
      />
    </AppShell>
  )
}

function TabButton({ id, current, onSelect, count, children }: { id: Tab; current: Tab; onSelect: (t: Tab) => void; count?: number; children: ReactNode }) {
  const on = id === current
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={on}
      aria-controls={`panel-${id}`}
      onClick={() => onSelect(id)}
      className={cn('relative flex items-end gap-2 pb-3 transition-colors', on ? 'text-vellum' : 'text-ink-faint hover:text-ink-muted')}
    >
      <span className="display text-3xl sm:text-4xl">{children}</span>
      {count !== undefined && <span className="tabular cmd pb-1 text-sm">{count}</span>}
      {on && <span aria-hidden className="absolute inset-x-0 -bottom-px h-1 bg-accent" />}
    </button>
  )
}

function TabPanel({ id, loading, error, children }: { id: Tab; loading: boolean; error: Error | null; children: ReactNode }) {
  return (
    <section id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} aria-busy={loading}>
      {error ? (
        <p className="mt-6 border-l-2 border-signal bg-canvas px-4 py-3 text-sm text-signal">Couldn’t load {id}: {error.message}</p>
      ) : loading ? (
        <div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse border-b border-line bg-panel/60" />
          ))}
        </div>
      ) : (
        children
      )}
    </section>
  )
}

interface LineupRowProps {
  to: string
  title: string
  description: string | null
  background: string | null
  creatures: { id: string; name: string; image_url: string | null }[]
  status: string
  live?: boolean
  updated: string
  onDelete: () => void
  action?: ReactNode
}

const THUMB_W = 120
const THUMB_H = 68

/** A row in the lineup. The whole row is a link (stretched ::after); real buttons sit above it. Hover raises it and marks its edge in moonlight. */
function LineupRow({ to, title, description, background, creatures, status, live, updated, onDelete, action }: LineupRowProps) {
  const cut = Math.round(THUMB_H * SLANT)
  return (
    <li className="group relative flex items-center gap-4 border-b border-line py-3 pr-2 pl-3 transition-colors before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent before:opacity-0 focus-within:bg-raised focus-within:before:opacity-100 hover:bg-raised hover:before:opacity-100 sm:gap-6">
      <span
        className="relative hidden shrink-0 overflow-hidden sm:block"
        style={{ width: THUMB_W, height: THUMB_H, clipPath: `polygon(0 0, calc(100% - ${cut}px) 0, 100% 100%, ${cut}px 100%)` }}
      >
        {background ? (
          <img src={background} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        ) : (
          <MonogramPlate name={title} monogramStyle={{ fontSize: THUMB_H * 1.05 }} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="display truncate text-2xl leading-[1.3] text-vellum">
          <Link to={to} className="after:absolute after:inset-0 focus-visible:outline-none">
            {title}
          </Link>
        </h3>
        <p className="mt-1 truncate text-sm text-ink-muted">
          {description || 'No scene description yet.'}
        </p>
      </div>

      <span className="hidden shrink-0 items-center -space-x-1 lg:flex" aria-hidden>
        {creatures.slice(0, 6).map((c) => (
          <Avatar key={c.id} name={c.name} src={c.image_url} size={28} />
        ))}
        {creatures.length > 6 && <span className="cmd pl-2 text-xs text-ink-faint">+{creatures.length - 6}</span>}
      </span>

      <div className="hidden w-44 shrink-0 text-right md:block">
        <p className={cn('cmd text-sm', live ? 'text-accent' : 'text-ink-muted')}>{status}</p>
        <time dateTime={updated} className="hint">
          edited {timeAgo(updated)}
        </time>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-1">
        {action}
        <IconButton label={`Delete ${title}`} size="icon-sm" onClick={onDelete} className="hover:text-signal">
          <Trash2 />
        </IconButton>
      </div>
    </li>
  )
}
