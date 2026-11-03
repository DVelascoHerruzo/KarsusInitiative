import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Swords } from 'lucide-react'
import { cn } from '@/lib/cn'

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
}

/** The home screens' image-forward card, for encounters, presets and campaigns. The whole card is a link. */
export function SceneCard({ to, title, description, background, strip, creatures, tags = [], tools, action, glow = 'teal', live }: SceneCardProps) {
  return (
    <div
      className={cn(
        'dnd-card group relative overflow-hidden transition-all duration-300',
        glow === 'gold' ? 'hover:border-dnd-gold/60 hover:shadow-glow-gold' : 'hover:border-dnd-teal/60 hover:shadow-glow-teal',
      )}
    >
      <div className="relative h-40 overflow-hidden">
        {background ? (
          <img src={background} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="bg-dragon-scale h-full w-full bg-dnd-dark" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dnd-card via-dnd-card/30 to-transparent" />

        {tools && (
          <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
            {tools}
          </div>
        )}

        <div className="absolute bottom-2 left-3 flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded bg-dnd-black/50 px-2 py-0.5 font-body text-[10px] tracking-widest backdrop-blur-sm', live ? 'text-dnd-jade' : 'text-dnd-amber/80')}>
            {strip}
          </span>
          {tags.map((t) => (
            <span key={t} className="rounded border border-dnd-jade/40 bg-dnd-black/60 px-1.5 py-0.5 font-body text-[10px] tracking-widest text-dnd-jade uppercase backdrop-blur-sm">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="p-4">
        <h3 className="truncate font-body font-medium text-dnd-parchment transition-colors group-hover:text-dnd-gold">
          <Link to={to} className="after:absolute after:inset-0 focus-visible:outline-none">
            {title}
          </Link>
        </h3>
        {description && <p className="mt-0.5 line-clamp-2 font-ui text-xs text-dnd-muted/80">{description}</p>}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-1.5" aria-hidden>
            {creatures.slice(0, 5).map((c) =>
              c.image_url ? (
                <img key={c.id} src={c.image_url} alt="" className="h-7 w-7 rounded-full border-2 border-dnd-card object-cover" />
              ) : (
                <div key={c.id} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dnd-card bg-dnd-surface">
                  <Swords className="h-3 w-3 text-dnd-muted" />
                </div>
              ),
            )}
            {creatures.length > 5 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dnd-card bg-dnd-surface text-[9px] text-dnd-muted">
                +{creatures.length - 5}
              </div>
            )}
          </div>
          {action ? <div className="relative z-10">{action}</div> : <ChevronRight className="h-4 w-4 text-dnd-muted transition-colors group-hover:text-dnd-gold" />}
        </div>
      </div>
    </div>
  )
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

export function CardSkeletons() {
  return (
    <CardGrid>
      {[0, 1, 2].map((i) => (
        <div key={i} className="dnd-card h-56 animate-pulse" />
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
