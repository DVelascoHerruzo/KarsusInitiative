import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { MonogramPlate } from '@/components/ui/display'
import { turnDirection, type TurnPosition } from '@/lib/combat'
import { cn } from '@/lib/cn'
import { SNAP } from './Cascade'

export interface StageCreature {
  id: string
  name: string
  image_url: string | null
}

/** Remembers where the turn was, so the stage knows which way to slide when it moves. */
export function useTurnDirection(position: TurnPosition): 1 | -1 {
  const [prev, setPrev] = useState(position)
  const [direction, setDirection] = useState<1 | -1>(1)
  if (prev.round !== position.round || prev.index !== position.index) {
    setPrev(position)
    setDirection(turnDirection(prev, position))
  }
  return direction
}

// Forward: the old portrait leaves to the left and the next arrives from the right.
const slide: Variants = {
  enter: (dir: 1 | -1) => ({ x: dir > 0 ? '100%' : '-100%' }),
  center: { x: 0 },
  exit: (dir: 1 | -1) => ({ x: dir > 0 ? '-100%' : '100%' }),
}

interface TurnStageProps {
  creature: StageCreature | null
  direction: 1 | -1
  /** Drawn over the portrait and slides with it: the name, a hint. */
  caption?: (creature: StageCreature) => ReactNode
  /** Fills the stage before combat starts. */
  idle: ReactNode
  className?: string
}

/**
 * The acting creature's portrait, full height against the left wall with its
 * right edge on the system slant. Decorative: each board announces the turn itself.
 */
export function TurnStage({ creature, direction, caption, idle, className }: TurnStageProps) {
  return (
    <div className={cn('stage', className)} aria-hidden>
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={creature?.id ?? 'idle'}
          custom={direction}
          variants={slide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.55, ease: SNAP }}
          className="absolute inset-0"
        >
          {creature ? (
            <>
              {creature.image_url ? (
                <img src={creature.image_url} alt="" className="absolute inset-0 size-full object-cover object-[50%_20%]" />
              ) : (
                <MonogramPlate name={creature.name} monogramStyle={{ fontSize: 'min(72cqh, 60cqw)' }} />
              )}
              <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-canvas/85 to-transparent" />
              {caption?.(creature)}
            </>
          ) : (
            idle
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
