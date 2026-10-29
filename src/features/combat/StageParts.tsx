import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { toRoman } from '@/lib/format'
import type { StageCreature } from './TurnStage'

/** The round counter: a Roman numeral in a hairline frame, like the face of the Dark Hour clock. */
export function RoundBox({ round, className }: { round: number; className?: string }) {
  return (
    <div className={cn('z-10 flex shrink-0 items-baseline gap-2.5 border border-line bg-canvas px-3.5 pt-1 pb-1.5', className)}>
      <span className="sr-only">Round {round}</span>
      <span aria-hidden className="display text-3xl leading-none text-vellum">
        {toRoman(round)}
      </span>
      <span aria-hidden className="hint">
        round
      </span>
    </div>
  )
}

/** A quiet bottom-right line with a hairline under it, for "what's next". */
export function CommandLine({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('lg:text-right', className)}>
      <p className="display truncate text-xl leading-[1.3] text-ink lg:text-2xl">{children}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="hint shrink-0">{label}</span>
        <span className="h-px flex-1 bg-ink/40" />
      </div>
    </div>
  )
}

/** The acting creature's name, laid over the bottom of its portrait. */
export function StageCaption({ creature, turnLabel }: { creature: StageCreature; turnLabel: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 pr-[14%] pb-[calc(var(--slant)*100cqw+12px)] pl-5 lg:pb-12 lg:pl-10">
      <p className="hint text-vellum">{turnLabel}</p>
      {/* Sized to the narrowest stage (the DM board); a name that still won't fit breaks with a hyphen. */}
      <p className="display print mt-1 line-clamp-2 text-[clamp(2.25rem,min(8.5cqh,5.5cqw),6.5rem)] leading-[1.02] break-words hyphens-auto text-vellum">
        {creature.name}
      </p>
    </div>
  )
}
