import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router'

interface SceneHeaderProps {
  title: string
  description: string | null
  background: string | null
  backTo: string
  backLabel: string
  actions?: ReactNode
}

/** Page title against a bar on the left, with the scene backdrop tinted into the field behind it. */
export function SceneHeader({ title, description, background, backTo, backLabel, actions }: SceneHeaderProps) {
  return (
    <div className="relative mb-10">
      {background && (
        <div
          className="pointer-events-none absolute -inset-x-6 -top-10 -z-10 h-72 overflow-hidden [mask-image:linear-gradient(to_bottom,black_40%,transparent)] sm:-inset-x-10"
          aria-hidden
        >
          <img src={background} alt="" className="size-full object-cover opacity-30 mix-blend-luminosity" />
        </div>
      )}
      <Link to={backTo} className="cmd mb-5 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" /> {backLabel}
      </Link>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 border-l-4 border-accent pl-5">
          <h1 className="display text-4xl break-words text-vellum sm:text-5xl">{title}</h1>
          {description && <p className="mt-3 max-w-2xl text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}
