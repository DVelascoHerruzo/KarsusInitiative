import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { BookOpen, ChevronRight, FolderOpen, Pencil, Swords, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { GroupedEncounters } from '@/lib/folders'

interface SceneCardProps {
  to: string
  title: string
  description: string | null
  background: string | null
  /** The small caps strip over the image: "ROUND 2 · 5 CREATURES". */
  strip: string
  creatures: { id: string; name: string; image_url: string | null }[]
  /** Labels next to the strip: Hidden, Co-DM… */
  tags?: string[]
  /** Hover buttons over the image. */
  tools?: ReactNode
  /** Buttons at the bottom right, in place of the chevron. */
  action?: ReactNode
  /** The glow colour on hover. */
  glow?: 'teal' | 'gold'
  live?: boolean
  /** Starts loading the page behind the card as soon as the pointer or keyboard reaches it, so opening it feels instant. */
  onPrefetch?: () => void
}

/**
 * The home screens' card for encounters and campaigns. The whole card is a link.
 * Like a file browser: a grid of small tiles on wider screens, a details list on a phone.
 */
export function SceneCard({ to, title, description, background, strip, creatures, tags = [], tools, action, glow = 'teal', live, onPrefetch }: SceneCardProps) {
  const labels = (
    <>
      <span className={cn('rounded bg-dnd-black/50 px-2 py-0.5 font-body text-[0.625rem] tracking-widest backdrop-blur-sm', live ? 'text-dnd-jade' : 'text-dnd-amber/80')}>
        {strip}
      </span>
      {tags.map((t) => (
        <span key={t} className="rounded border border-dnd-jade/40 bg-dnd-black/60 px-1.5 py-0.5 font-body text-[0.625rem] tracking-widest text-dnd-jade uppercase backdrop-blur-sm">
          {t}
        </span>
      ))}
    </>
  )
  return (
    <div
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
      className={cn(
        'dnd-card group relative flex items-center overflow-hidden transition-all duration-300 sm:block',
        glow === 'gold' ? 'hover:border-dnd-gold/60 hover:shadow-glow-gold' : 'hover:border-dnd-teal/60 hover:shadow-glow-teal',
      )}
    >
      <div className="relative m-2 h-14 w-16 shrink-0 overflow-hidden rounded-lg sm:m-0 sm:h-28 sm:w-auto sm:rounded-none">
        {background ? (
          <img src={background} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="bg-dragon-scale h-full w-full bg-dnd-dark" />
        )}
        <div className="absolute inset-0 hidden bg-gradient-to-t from-dnd-card via-dnd-card/30 to-transparent sm:block" />

        {tools && (
          <div className="absolute top-2 right-2 z-10 hidden gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 sm:flex">{tools}</div>
        )}
        <div className="absolute bottom-2 left-3 hidden flex-wrap items-center gap-1.5 sm:flex">{labels}</div>
      </div>

      <div className="min-w-0 flex-1 py-2 pr-2 sm:p-3">
        <h3 className="truncate font-body text-sm font-medium text-dnd-parchment transition-colors group-hover:text-dnd-gold">
          <Link to={to} className="after:absolute after:inset-0 focus-visible:outline-none">
            {title}
          </Link>
        </h3>
        {description && <p className="mt-0.5 truncate font-ui text-xs text-dnd-muted/80 sm:line-clamp-2 sm:whitespace-normal">{description}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1 sm:hidden">{labels}</div>

        <div className="mt-2 hidden items-center justify-between sm:flex">
          <div className="flex -space-x-1.5" aria-hidden>
            {creatures.slice(0, 5).map((c) =>
              c.image_url ? (
                <img key={c.id} src={c.image_url} alt="" className="h-6 w-6 rounded-full border-2 border-dnd-card object-cover" />
              ) : (
                <div key={c.id} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dnd-card bg-dnd-surface">
                  <Swords className="h-3 w-3 text-dnd-muted" />
                </div>
              ),
            )}
            {creatures.length > 5 && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dnd-card bg-dnd-surface text-[0.5625rem] text-dnd-muted">
                +{creatures.length - 5}
              </div>
            )}
          </div>
          {action ? <div className="relative z-10">{action}</div> : <ChevronRight className="h-4 w-4 text-dnd-muted transition-colors group-hover:text-dnd-gold" />}
        </div>
      </div>

      {/* On a phone the tools and action sit at the end of the row. */}
      <div className="relative z-10 flex shrink-0 items-center gap-1 pr-2 sm:hidden">
        {tools}
        {action ?? <ChevronRight className="h-4 w-4 text-dnd-muted" />}
      </div>
    </div>
  )
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
}

export function CardSkeletons() {
  return (
    <CardGrid>
      {[0, 1, 2].map((i) => (
        <div key={i} className="dnd-card h-18 animate-pulse sm:h-48" />
      ))}
    </CardGrid>
  )
}

/** "No encounters yet" in a card, with a way to make the first. */
export function EmptyCard({ icon, text, action }: { icon: ReactNode; text: string; action?: ReactNode }) {
  return (
    <div className="dnd-card p-10 text-center">
      <div className="mx-auto mb-3 flex justify-center text-dnd-muted/40">{icon}</div>
      <p className="font-ui text-dnd-muted italic">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SectionHeading({ icon, title, count, action }: { icon: ReactNode; title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-body text-xl tracking-widest text-dnd-parchment uppercase">{title}</h2>
        {count !== undefined && <span className="ml-1 rounded-full bg-dnd-surface px-2 py-0.5 text-xs text-dnd-muted">{count}</span>}
      </div>
      {action}
    </div>
  )
}

export function Hero({ eyebrow, title, tagline }: { eyebrow: string; title: string; tagline: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl px-6 py-14 text-center">
      <div className="bg-dragon-scale absolute inset-0 rounded-2xl opacity-60" />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-dnd-teal/5 via-transparent to-dnd-gold/5" />
      <div className="relative">
        <p className="mb-3 font-body text-xs tracking-[0.4em] text-dnd-amber/60 uppercase">{eyebrow}</p>
        <h1 className="mb-2 font-display text-4xl tracking-widest text-dnd-gold sm:text-5xl">{title}</h1>
        <p className="font-ui text-base text-dnd-muted italic">{tagline}</p>
      </div>
    </div>
  )
}

/**
 * An encounter list in its folders: live encounters first, under a pulsing
 * heading, then the person's own folders, then one group per campaign, then the
 * rest. With nothing to group it's just the grid.
 */
export function EncounterGroups<T extends { id: string }>({
  groups,
  render,
  looseLabel = 'Not in a folder',
  onRenameFolder,
  onDeleteFolder,
}: {
  groups: GroupedEncounters<T>
  render: (encounter: T, group: string | null) => ReactNode
  looseLabel?: string
  onRenameFolder?: (id: string, name: string) => void
  onDeleteFolder?: (id: string) => void
}) {
  const plain = groups.live.length === 0 && groups.folders.length === 0 && groups.campaigns.length === 0
  if (plain) return <CardGrid>{groups.loose.map((e) => render(e, null))}</CardGrid>
  return (
    <div className="space-y-5">
      {groups.live.length > 0 && (
        <section aria-label="Live now">
          <h3
            className="mb-2 flex items-center gap-2 font-body text-sm tracking-[0.25em] text-dnd-jade uppercase"
            title="Encounters a DM has open right now. Open one to follow the fight as it happens."
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-dnd-jade shadow-glow-jade" /> Live now
          </h3>
          <CardGrid>{groups.live.map((e) => render(e, null))}</CardGrid>
        </section>
      )}
      {groups.folders.map((f) => (
        <Group
          key={f.id}
          icon={<FolderOpen className="h-4 w-4 text-dnd-jade" />}
          name={f.name}
          count={f.encounters.length}
          tip="Your own folder. Only you see it: filing an encounter here doesn’t change who else can see it."
          onRename={onRenameFolder && ((name) => onRenameFolder(f.id, name))}
          onDelete={onDeleteFolder && (() => onDeleteFolder(f.id))}
        >
          {f.encounters.length ? (
            <CardGrid>{f.encounters.map((e) => render(e, f.name))}</CardGrid>
          ) : (
            <p className="rounded-lg border border-dashed border-dnd-border px-4 py-3 font-ui text-sm text-dnd-muted italic">
              Empty. Use the folder button on any encounter to move it here.
            </p>
          )}
        </Group>
      ))}
      {groups.campaigns.map((f) => (
        <Group
          key={f.id}
          icon={<BookOpen className="h-4 w-4 text-dnd-gold" />}
          name={f.name}
          count={f.encounters.length}
          tip="A campaign. Encounters launched from it land here, and its players see them unless they’re hidden."
        >
          <CardGrid>{f.encounters.map((e) => render(e, f.name))}</CardGrid>
        </Group>
      ))}
      {groups.loose.length > 0 && (
        <section aria-label={looseLabel}>
          <h3 className="mb-2 font-body text-sm tracking-[0.2em] text-dnd-muted uppercase">{looseLabel}</h3>
          <CardGrid>{groups.loose.map((e) => render(e, null))}</CardGrid>
        </section>
      )}
    </div>
  )
}

/** A collapsible group heading. A personal folder can be renamed in place or deleted. */
function Group({
  icon,
  name,
  count,
  tip,
  onRename,
  onDelete,
  children,
}: {
  icon: ReactNode
  name: string
  count: number
  tip: string
  onRename?: (name: string) => void
  onDelete?: () => void
  children: ReactNode
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft?.trim() && draft.trim() !== name) onRename?.(draft)
    setDraft(null)
  }
  const stop = (e: { preventDefault(): void; stopPropagation(): void }) => {
    e.preventDefault()
    e.stopPropagation()
  }
  return (
    <details open className="group/folder">
      <summary className="mb-2 flex cursor-pointer list-none items-center gap-2 font-body text-sm tracking-[0.2em] text-dnd-parchment uppercase select-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 text-dnd-muted transition-transform group-open/folder:rotate-90" />
        {icon}
        {draft !== null ? (
          <input
            autoFocus
            aria-label="Folder name"
            value={draft}
            maxLength={60}
            onClick={stop}
            onKeyDown={(e) => {
              if (e.key === ' ') e.stopPropagation()
              if (e.key === 'Enter') {
                stop(e)
                commit()
              }
              if (e.key === 'Escape') {
                stop(e)
                setDraft(null)
              }
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            className="dnd-input w-56 px-2 py-0.5 text-sm tracking-normal normal-case"
          />
        ) : (
          <span title={tip}>{name}</span>
        )}
        <span className="rounded-full bg-dnd-surface px-2 py-0.5 text-xs tracking-normal text-dnd-muted normal-case">{count}</span>
        {onRename && draft === null && (
          <button
            type="button"
            onClick={(e) => {
              stop(e)
              setDraft(name)
            }}
            aria-label={`Rename ${name}`}
            title="Rename this folder"
            className="rounded p-1 text-dnd-muted hover:text-dnd-gold"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              stop(e)
              onDelete()
            }}
            aria-label={`Delete ${name}`}
            title="Delete this folder. Its encounters aren’t deleted: they go back to their usual place."
            className="rounded p-1 text-dnd-muted hover:text-dnd-red"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </summary>
      {children}
    </details>
  )
}
