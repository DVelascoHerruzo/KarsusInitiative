import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronDown, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/cn'
import { Emblem, SLANT_DEG } from '@/components/ui/display'
import { ButtonLink } from '@/components/ui/Button'

export function Brand({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('flex shrink-0 items-center gap-2', className)} aria-label="Karsus Initiative, home">
      <Emblem className="size-6" />
      <span className="display text-[26px] leading-none text-vellum">Karsus</span>
    </Link>
  )
}

/** A hairline on the system angle, for separating items in a bar. */
export function SlantRule({ className }: { className?: string }) {
  return <span aria-hidden className={cn('h-7 w-px shrink-0 bg-line', className)} style={{ transform: `skewX(${SLANT_DEG}deg)` }} />
}

/** Click-to-open panel that closes on outside click or Escape. */
function Popover({ label, trigger, children }: { label: string; trigger: (open: boolean) => ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 pr-2 pl-0.5 text-sm transition-colors hover:bg-raised"
      >
        {trigger(open)}
      </button>
      {open && <div className="absolute right-0 z-50 mt-2 w-64 border-t-2 border-rubric bg-panel p-1">{children}</div>}
    </div>
  )
}

function UserMenu() {
  const { displayName, user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <Popover
      label="Account menu"
      trigger={(open) => (
        <>
          <span className="display flex size-8 items-center justify-center border border-line bg-raised text-lg leading-none text-vellum">
            {displayName.slice(0, 1)}
          </span>
          <span className="hidden max-w-32 truncate sm:block">{displayName}</span>
          <ChevronDown className={cn('size-3.5 text-ink-faint transition-transform', open && 'rotate-180')} />
        </>
      )}
    >
      <div className="border-b border-line px-3 py-2.5">
        <p className="truncate text-sm font-semibold">{displayName}</p>
        <p className="truncate text-xs text-ink-faint">{user?.email}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await signOut()
          toast('Signed out. Farewell, adventurer.')
          navigate('/')
        }}
        className="cmd mt-1 flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink-muted hover:bg-raised hover:text-ink"
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </Popover>
  )
}

interface AppShellProps {
  children: ReactNode
  /** Page name shown in the bar, for screens that need their full height (the combat board). */
  title?: string
  /** Shown on hover over the title. */
  subtitle?: string | null
  /** Extra content for the right side of the bar, before the account menu. */
  actions?: ReactNode
  /** No max width or padding: the page draws edge to edge under the bar. */
  bleed?: boolean
  /** Signed-out pages (the demo): a sign-up button instead of the account menu. */
  guest?: boolean
}

export function AppShell({ children, title, subtitle, actions, bleed, guest }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 bg-vellum px-3 py-2 text-vellum-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 h-[52px] shrink-0 border-b border-line bg-canvas">
        <div className={cn('mx-auto flex h-full items-center gap-3 px-4', bleed ? 'max-w-none' : 'max-w-6xl sm:px-6')}>
          {/* With a page title on a phone, the emblem alone stands for the brand. */}
          <Brand className={title ? 'max-sm:[&>span]:hidden' : undefined} />
          {title && (
            <>
              <SlantRule className="mx-1" />
              <h1 className="display min-w-0 truncate text-xl text-vellum" title={subtitle ?? undefined}>
                {title}
              </h1>
            </>
          )}
          <div className="flex-1" />
          {actions}
          {guest ? (
            <ButtonLink to="/login" variant="accent" size="sm" className="hidden sm:inline-flex">
              Sign up free
            </ButtonLink>
          ) : (
            <UserMenu />
          )}
        </div>
      </header>
      <main id="main" className={cn('w-full flex-1', !bleed && 'mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10')}>
        {children}
      </main>
    </div>
  )
}
