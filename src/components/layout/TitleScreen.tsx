import type { ReactNode } from 'react'
import { Brand } from './AppShell'

interface TitleScreenProps {
  title: ReactNode
  lede?: ReactNode
  /** Buttons, directly under the lede. */
  actions?: ReactNode
  /** A form, beside the title on wide screens and under it on narrow ones. */
  children?: ReactNode
}

/** A whole page laid out like a title screen: a solid bar on the left wall and a huge stacked headline. */
export function TitleScreen({ title, lede, actions, children }: TitleScreenProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <span aria-hidden className="absolute top-[24%] bottom-[24%] left-0 w-3 bg-accent sm:w-6 lg:w-10" />
      <header className="flex h-16 items-center pr-5 pl-8 sm:pl-14 lg:pl-20">
        <Brand />
      </header>
      <main className="flex flex-1 items-center pr-5 pb-16 pl-8 sm:pr-10 sm:pl-14 lg:pl-20">
        <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:items-center lg:gap-16">
          <div>
            <h1 className="display text-4xl text-vellum sm:text-6xl lg:text-[clamp(4.5rem,7.5vw,8rem)]">{title}</h1>
            {lede && <div className="mt-6 max-w-md text-lg leading-relaxed text-ink-muted">{lede}</div>}
            {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
          </div>
          {children && <div className="w-full max-w-md">{children}</div>}
        </div>
      </main>
    </div>
  )
}
