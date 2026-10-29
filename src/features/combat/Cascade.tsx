import type { ComponentProps, CSSProperties } from 'react'
import { motion, type HTMLMotionProps, type MotionStyle } from 'motion/react'
import { SLANT_DEG } from '@/components/ui/display'
import { cn } from '@/lib/cn'

export const SNAP = [0.77, 0, 0.18, 1] as const

/**
 * The shared geometry for a turn stage and its cascade (see `.board` in index.css).
 * `count` is the number of rows, so they can grow to fill the height.
 */
export function Board({ count, className, style, ...props }: ComponentProps<'div'> & { count: number }) {
  return <div className={cn('board', className)} style={{ '--n': Math.max(count, 1), ...style } as CSSProperties} {...props} />
}

/** The initiative order, stepping down and right along the stage's edge. */
export function Cascade({ className, ...props }: HTMLMotionProps<'ol'>) {
  return <motion.ol layoutScroll className={cn('cascade', className)} {...props} />
}

/** One row of the cascade; `index` sets how far along the slope it sits. */
export function CascadeRow({ index, className, style, ...props }: HTMLMotionProps<'li'> & { index: number }) {
  return (
    <motion.li
      layout="position"
      transition={{ type: 'spring', stiffness: 500, damping: 45 }}
      className={cn('cascade-row isolate', className)}
      style={{ '--i': index, ...style } as MotionStyle}
      {...props}
    />
  )
}

/**
 * A vellum shard over a rubric sliver (see `.shard` in index.css) that travels
 * between the items sharing its `layoutId`. Place it inside a `relative isolate` box.
 */
export function Shard({ layoutId, className }: { layoutId: string; className?: string }) {
  return (
    <motion.span layoutId={layoutId} aria-hidden transition={{ duration: 0.45, ease: SNAP }} className={cn('shard', className)} />
  )
}

/** The shard behind whoever is acting. There's only ever one, and it travels from row to row when the turn passes. */
export function TurnWedge({ className }: { className?: string }) {
  return <Shard layoutId="turn-wedge" className={className} />
}

/** The DM's cursor: a moonlight outline on the system angle, a different cut from the acting shard. */
export function SelectWedge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('absolute inset-0 -z-10 border-[1.5px] border-accent', className)}
      style={{ transform: `skewX(${SLANT_DEG}deg)` }}
    />
  )
}
