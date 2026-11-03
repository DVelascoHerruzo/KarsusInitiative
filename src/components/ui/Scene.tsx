import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Shield } from 'lucide-react'

/**
 * The sign-in page's look: the city backdrop under a dark wash, soft glows, the
 * shield crest and one card. Used for sign-in, password reset, and messages like
 * "this table is closed".
 */
export function CenterScene({ children, back = true, subtitle = 'INITIATIVE TRACKER' }: { children: ReactNode; back?: boolean; subtitle?: string }) {
  return (
    <div className="bg-adventure relative flex min-h-screen items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-0 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-dnd-amber/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-dnd-teal/8 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-64 w-64 rounded-full bg-dnd-crimson/6 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {back && (
          <div className="mb-6">
            <Link to="/" className="flex w-fit items-center gap-1.5 font-body text-sm tracking-wider text-dnd-muted transition-colors hover:text-dnd-parchment">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </div>
        )}

        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full border-2 border-dnd-jade bg-dnd-teal/20 shadow-glow-jade">
            <Shield className="h-10 w-10 text-dnd-jade" />
          </div>
          <p className="font-display text-3xl tracking-widest text-dnd-jade">KARSUS</p>
          <p className="mt-1 font-body text-sm tracking-[0.3em] text-dnd-muted">{subtitle}</p>
        </div>

        {children}

        <p className="mt-6 text-center font-ui text-xs text-dnd-muted italic">“Roll for initiative.”</p>
      </div>
    </div>
  )
}

/** A short message in the scene card, with a way onward. */
export function MessageScreen({ icon, title, body, actions }: { icon?: ReactNode; title: string; body?: ReactNode; actions?: ReactNode }) {
  return (
    <CenterScene back={false}>
      <title>{`${title} · Karsus`}</title>
      <div className="dnd-card flex flex-col items-center gap-4 p-8 text-center">
        {icon}
        <h1 className="font-body text-xl tracking-widest text-dnd-gold uppercase">{title}</h1>
        {body && <div className="font-ui text-dnd-muted">{body}</div>}
        {actions && <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div>}
      </div>
    </CenterScene>
  )
}
