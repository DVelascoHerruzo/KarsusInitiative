import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronDown, Keyboard, LogOut, Palette, ShieldCheck, User } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthProvider'
import { ShortcutsDialog } from '@/features/combat/ShortcutsDialog'
import { cn } from '@/lib/cn'
import { THEMES, useTheme } from '@/lib/theme'
import type { Mode } from '@/lib/types'
import { Emblem } from './Emblem'
import { LegalFooter } from './LegalFooter'

interface LayoutProps {
  children: ReactNode
  /** Small caps title in the middle of the bar. */
  title?: string
  /** Signed-out pages (the demo): sign-in buttons instead of the account menu. */
  guest?: boolean
}

export default function Layout({ children, title, guest }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* The city stays in view, washed dark enough for text to read over it. */}
      <div aria-hidden className="bg-adventure pointer-events-none fixed inset-0 -z-10" />
      <a href="#main" className="sr-only z-50 rounded bg-dnd-teal px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <header className="dnd-header sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />

          {title && <p className="hidden truncate font-body text-xs tracking-[0.3em] text-dnd-jade/60 uppercase md:block">{title}</p>}

          {guest ? (
            <div className="flex items-center gap-2">
              <Link to="/login" className="dnd-button-ghost px-3 py-1.5 text-sm">
                Sign In
              </Link>
              <Link to="/login" state={{ mode: 'register' }} className="dnd-button-primary px-4 py-1.5 text-sm">
                Sign Up
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ModeSwitch />
              <AccountMenu />
            </div>
          )}
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-dnd-border/20 px-4 py-4 text-center font-ui text-[11px] leading-relaxed text-dnd-muted/70">
        <p className="mb-1 text-xs text-dnd-muted/50">⚔ Karsus Initiative Tracker ⚔</p>
        <LegalFooter />
      </footer>
    </div>
  )
}

export function Logo({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Karsus Initiative, home">
      <Emblem
        className={cn(
          'shrink-0 text-dnd-jade drop-shadow-[0_0_6px_rgb(var(--theme-accent-rgb)/0.45)] transition-transform group-hover:scale-105',
          size === 'md' ? 'h-10 w-10' : 'h-9 w-9',
        )}
      />
      <div className="leading-tight">
        <span className={cn('font-display tracking-widest text-dnd-jade', size === 'md' ? 'text-base' : 'text-sm')}>KARSUS</span>
        <span className="block font-body text-[10px] tracking-[0.25em] text-dnd-muted">INITIATIVE</span>
      </div>
    </Link>
  )
}

const MODES: { mode: Mode; label: string; short: string }[] = [
  { mode: 'dm', label: 'Dungeon Master', short: 'DM' },
  { mode: 'player', label: 'Player', short: 'Player' },
]

/** Which side of the table you're on. Remembered on the account; the home screen follows it. */
function ModeSwitch() {
  const { mode, setMode } = useAuth()
  const navigate = useNavigate()
  return (
    <div role="radiogroup" aria-label="Play as" className="flex rounded-lg border border-dnd-border bg-dnd-dark/70 p-0.5">
      {MODES.map((m) => {
        const on = m.mode === mode
        return (
          <button
            key={m.mode}
            type="button"
            role="radio"
            aria-checked={on}
            title={m.mode === 'dm' ? 'Run encounters and campaigns. Karsus remembers which side you were on.' : 'See the campaigns and fights you’ve joined, and your characters. Karsus remembers which side you were on.'}
            onClick={() => {
              if (!on) setMode(m.mode)
              navigate('/')
            }}
            className={cn(
              'rounded-md px-2.5 py-1 font-body text-[11px] tracking-widest uppercase transition-colors sm:px-3',
              on ? 'bg-dnd-teal text-white shadow-glow-teal' : 'text-dnd-muted hover:text-dnd-parchment',
            )}
          >
            <span className="sm:hidden">{m.short}</span>
            <span className="max-sm:hidden">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function AccountMenu() {
  const { displayName, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { theme, setTheme, custom, setCustom } = useTheme()
  const [shortcuts, setShortcuts] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) setOpen(false)
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
    <div className="relative" ref={menu}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Account menu"
        title="Colour theme, keyboard shortcuts and signing out"
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-ui text-sm text-dnd-jade transition-colors hover:bg-dnd-surface/60"
      >
        <User className="h-3.5 w-3.5" />
        <span className="hidden max-w-32 truncate text-xs tracking-widest sm:block">{displayName}</span>
        <ChevronDown className={cn('h-3 w-3 opacity-60 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="dnd-card absolute top-full right-0 z-50 mt-1 w-64 animate-slide-in py-2">
          <div className="border-b border-dnd-border/50 px-3 pb-2">
            <p className="truncate font-body text-sm text-dnd-parchment">{displayName}</p>
            <p className="truncate text-xs text-dnd-muted">{user?.email}</p>
          </div>
          <div className="px-3 py-2">
            <p className="mb-2 flex items-center gap-1.5 font-body text-[10px] tracking-[0.2em] text-dnd-muted uppercase">
              <Palette className="h-3 w-3" /> Color Theme
            </p>
            <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Color theme">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.id}
                  aria-label={t.label}
                  title={t.label}
                  onClick={() => setTheme(t.id)}
                  className="flex aspect-square w-full items-center justify-center rounded-md border-2 transition-all hover:scale-110"
                  style={{ backgroundColor: `${t.color}22`, borderColor: theme === t.id ? t.color : 'rgba(255,255,255,0.08)' }}
                >
                  <span className="block h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: t.color }} />
                </button>
              ))}
            </div>

            {/* Your own colours: any pick switches to the custom theme. */}
            <div
              className={cn('mt-2 rounded-lg border-2 p-2 transition-colors', theme === 'custom' ? 'border-dnd-jade/70' : 'border-white/8')}
              role="group"
              aria-label="Custom colors"
            >
              <button
                type="button"
                onClick={() => setTheme('custom')}
                aria-pressed={theme === 'custom'}
                className="mb-1.5 flex w-full items-center gap-2 font-body text-[10px] tracking-[0.2em] text-dnd-muted uppercase hover:text-dnd-parchment"
              >
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-full"
                  style={{ background: 'conic-gradient(#ef4444, #fbbf24, #34d399, #2dd4bf, #60a5fa, #a78bfa, #ef4444)' }}
                />
                Custom
              </button>
              <div className="grid grid-cols-2 gap-2">
                <ColorField label="Main" value={custom.primary} onChange={(primary) => setCustom({ ...custom, primary })} />
                <ColorField label="Text accent" value={custom.heading} onChange={(heading) => setCustom({ ...custom, heading })} />
              </div>
            </div>
          </div>
          <div className="mt-1 border-t border-dnd-border/50 px-1 pt-1">
            <Link
              to="/account"
              onClick={() => setOpen(false)}
              title="Change your password, sign out other devices, download your data or delete your account"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-ui text-sm text-dnd-muted transition-colors hover:bg-dnd-surface/60 hover:text-dnd-parchment"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Account &amp; Security
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setShortcuts(true)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-ui text-sm text-dnd-muted transition-colors hover:bg-dnd-surface/60 hover:text-dnd-parchment"
            >
              <Keyboard className="h-3.5 w-3.5" />
              Keyboard Shortcuts
            </button>
            <button
              type="button"
              onClick={async () => {
                await signOut()
                toast.success('Farewell, adventurer!')
                navigate('/')
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-ui text-sm text-dnd-muted transition-colors hover:bg-dnd-surface/60 hover:text-dnd-red"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-dnd-dark/60 p-1 pr-2 hover:bg-dnd-surface/60">
      <input
        type="color"
        value={value.toLowerCase()}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
      />
      <span className="truncate font-ui text-[11px] text-dnd-parchment">{label}</span>
    </label>
  )
}

/** The old pages' header: a back link, a title in display type, and actions on the right. */
export function PageHeader({
  back,
  eyebrow,
  title,
  description,
  actions,
}: {
  back?: { to: string; label: string }
  eyebrow?: string
  title: string
  description?: string | null
  actions?: ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {back && (
          <Link to={back.to} className="dnd-button-ghost px-3 py-2">
            ‹ {back.label}
          </Link>
        )}
        <div className="flex-1" />
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="min-w-0">
        {eyebrow && <span className="font-body text-xs tracking-widest text-dnd-gold/50 uppercase">{eyebrow}</span>}
        <h1 className="font-display text-3xl break-words text-dnd-gold">{title}</h1>
        {description && <p className="mt-1 font-ui text-dnd-muted italic">{description}</p>}
      </div>
    </div>
  )
}
