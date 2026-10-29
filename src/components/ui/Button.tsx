import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

// Every button sits on the system angle; only the main action is filled, the rest are drawn in line.
const base =
  'wedge cmd inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap select-none transition-colors ' +
  'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0'

const variants: Record<Variant, string> = {
  // Vellum is the loudest surface after the active turn, so it's kept for the one main action.
  // Hover flips it to rubric, the way a menu item turns red as it's chosen.
  primary: 'text-vellum-ink [--wedge:var(--color-vellum)] hover:text-vellum hover:[--wedge:var(--color-rubric)]',
  accent: 'text-accent-ink [--wedge:var(--color-accent)] hover:[--wedge:var(--color-accent-soft)]',
  secondary: 'text-ink [--wedge-line:var(--color-line)] hover:[--wedge:var(--color-raised)] hover:[--wedge-line:var(--color-ink-faint)]',
  ghost: 'text-ink-muted hover:text-ink hover:[--wedge:var(--color-raised)]',
  danger: 'text-vellum [--wedge:var(--color-rubric)] hover:[--wedge:oklch(0.44_0.18_var(--hue-signal))]',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-sm',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
  icon: 'size-10',
  'icon-sm': 'size-8',
}

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant
  size?: Size
}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />
}

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size'> {
  label: string
  size?: 'icon' | 'icon-sm'
  children: ReactNode
}

/** Icon-only button; `label` is required so it is never unlabeled for screen readers. */
export function IconButton({ label, variant = 'ghost', size = 'icon', title, ...props }: IconButtonProps) {
  return <Button aria-label={label} title={title ?? label} variant={variant} size={size} {...props} />
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant
  size?: Size
}

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}
