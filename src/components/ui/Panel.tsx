import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** A flat raised surface. Compose with PanelHeader + content. */
export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('flex flex-col bg-panel', className)} {...props} />
}

interface PanelHeaderProps {
  title: ReactNode
  /** Small secondary text beside the title: a count, a state. */
  meta?: ReactNode
  actions?: ReactNode
  id?: string
  className?: string
}

/** The panel's name in display type over a hairline, with actions on the right. */
export function PanelHeader({ title, meta, actions, id, className }: PanelHeaderProps) {
  return (
    <header className={cn('flex min-h-12 items-end gap-3 border-b border-line px-4 pt-3 pb-2', className)}>
      <h2 id={id} className="display shrink-0 text-xl whitespace-nowrap text-vellum">
        {title}
      </h2>
      {meta !== undefined && <span className="hint min-w-0 truncate pb-1">{meta}</span>}
      <div className="flex-1" />
      {actions && <div className="-mr-2 flex items-center gap-1">{actions}</div>}
    </header>
  )
}

/** A compact command for a panel header. */
export function PanelAction({ className, type = 'button', ...props }: ComponentProps<'button'>) {
  return (
    <button
      type={type}
      className={cn(
        'wedge cmd inline-flex h-7 items-center gap-1.5 px-2.5 text-sm text-ink-muted transition-colors',
        'hover:text-ink hover:[--wedge:var(--color-raised)] disabled:opacity-40 [&_svg]:size-3.5',
        className,
      )}
      {...props}
    />
  )
}
