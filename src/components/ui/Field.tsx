import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const inputClass =
  'h-10 w-full border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] ' +
  'focus:border-accent focus:shadow-[inset_0_-2px_0_var(--color-accent)] focus:outline-none ' +
  'aria-invalid:border-signal aria-invalid:shadow-[inset_0_-2px_0_var(--color-signal)]'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  className?: string
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode
}

/** Label + control + hint/error, wired up with ids for assistive tech. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  const descId = `${id}-desc`
  const describe = hint || error ? descId : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="cmd text-sm text-ink-muted">
        {label}
      </label>
      {children({ id, 'aria-describedby': describe, ...(error ? { 'aria-invalid': true as const } : {}) })}
      {(error || hint) && (
        <p id={descId} className={cn('text-xs', error ? 'text-signal' : 'text-ink-faint')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(inputClass, 'h-auto min-h-20 resize-y py-2 leading-relaxed', className)} {...props} />
}

interface NumberInputProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  value: number | null
  onValueChange: (value: number | null) => void
}

/** Number input that tracks `null` for "empty" instead of NaN or 0. */
export function NumberInput({ value, onValueChange, className, ...props }: NumberInputProps) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={cn(inputClass, 'tabular', className)}
      value={value ?? ''}
      onChange={(e) => onValueChange(e.target.value === '' ? null : Math.trunc(Number(e.target.value)))}
      {...props}
    />
  )
}

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  description?: string
}

export function Switch({ checked, onCheckedChange, label, description }: SwitchProps) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="flex flex-col">
        <span className="text-sm text-ink">{label}</span>
        {description && <span className="text-xs text-ink-faint">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 border transition-colors', checked ? 'border-accent bg-accent' : 'border-line bg-canvas')}
      >
        <span
          className={cn(
            'absolute top-[3px] left-[3px] size-4 transition-transform duration-200 ease-snap',
            checked ? 'translate-x-5 bg-accent-ink' : 'bg-ink-faint',
          )}
        />
      </button>
    </div>
  )
}
