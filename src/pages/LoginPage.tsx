import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Eye, EyeOff, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { TitleScreen } from '@/components/layout/TitleScreen'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/display'
import { useAuth } from '@/features/auth/AuthProvider'
import { api, isBackendConfigured } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { User } from '@/lib/types'

type Mode = 'sign-in' | 'sign-up' | 'forgot'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (loading) return <PageLoader />
  if (user) return <Navigate to={from} replace />

  return isBackendConfigured ? (
    <AuthForm onSignedIn={from} />
  ) : (
    <TitleScreen
      title={
        <>
          Accounts aren’t
          <br />
          set up here
        </>
      }
      lede="This build runs without the accounts API. You can still try everything in the demo."
      actions={
        <ButtonLink to="/demo" variant="primary" size="lg">
          Open the demo
        </ButtonLink>
      }
    >
      <title>Sign in · Karsus</title>
    </TitleScreen>
  )
}

const HEADLINES: Record<Mode, ReactNode> = {
  'sign-in': (
    <>
      Welcome
      <br />
      back
    </>
  ),
  'sign-up': (
    <>
      Join the
      <br />
      table
    </>
  ),
  forgot: (
    <>
      Reset your
      <br />
      password
    </>
  ),
}

function AuthForm({ onSignedIn }: { onSignedIn: string }) {
  const navigate = useNavigate()
  const { signedIn, googleSignIn } = useAuth()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  // The Google callback sends people back here with ?error=google when it can't finish.
  const [error, setError] = useState<string | null>(
    params.get('error') === 'google' ? 'Google sign-in didn’t finish. Try again, or use your email and password.' : null,
  )
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      if (mode === 'sign-in') {
        const { user } = await api.post<{ user: User }>('auth/signin', { email, password })
        signedIn(user)
        navigate(onSignedIn, { replace: true })
      } else if (mode === 'sign-up') {
        const { user } = await api.post<{ user: User }>('auth/signup', { email, password, username: username.trim() })
        signedIn(user)
        toast.success('Welcome to the table!')
        navigate('/', { replace: true })
      } else {
        await api.post('auth/forgot', { email })
        setSentTo(email)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPending(false)
    }
  }

  function google() {
    // A full-page trip through Google; the API sets the session cookie and sends us back.
    window.location.assign(`/api/auth/google?next=${encodeURIComponent(onSignedIn)}`)
  }

  if (sentTo) {
    return (
      <TitleScreen
        title={
          <>
            Check your
            <br />
            inbox
          </>
        }
        lede={
          <p role="status">
            If there’s an account for <span className="text-ink">{sentTo}</span>, a password reset link is on its way. It works for one hour.
          </p>
        }
        actions={<Button onClick={() => { setSentTo(null); setMode('sign-in') }}>Back to sign in</Button>}
      >
        <title>Check your inbox · Karsus</title>
        <MailCheck className="size-12 text-accent" aria-hidden />
      </TitleScreen>
    )
  }

  return (
    <TitleScreen
      title={HEADLINES[mode]}
      lede={mode === 'forgot' ? 'We’ll email you a link to choose a new one.' : 'Your encounters, presets and player links in one place.'}
    >
      <title>Sign in · Karsus</title>
      {mode !== 'forgot' && (
        <div role="tablist" aria-label="Account" className="flex gap-6 border-b border-line">
          {(['sign-in', 'sign-up'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setError(null) }}
              className={cn('cmd relative pb-2.5 text-lg transition-colors', mode === m ? 'text-vellum' : 'text-ink-faint hover:text-ink-muted')}
            >
              {m === 'sign-in' ? 'Sign in' : 'Create account'}
              {mode === m && <span aria-hidden className="absolute inset-x-0 -bottom-px h-1 bg-accent" />}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-5">
        {mode === 'sign-up' && (
          <Field label="Display name">
            {(p) => <Input {...p} required minLength={2} maxLength={40} autoComplete="nickname" value={username} onChange={(e) => setUsername(e.target.value)} />}
          </Field>
        )}
        <Field label="Email">
          {(p) => <Input {...p} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        {mode !== 'forgot' && (
          <Field
            label="Password"
            hint={
              mode === 'sign-in' ? (
                <button type="button" className="text-accent underline decoration-accent/50 underline-offset-2 hover:decoration-accent" onClick={() => { setMode('forgot'); setError(null) }}>
                  Forgot password?
                </button>
              ) : 'At least 8 characters.'
            }
          >
            {(p) => (
              <div className="relative">
                <Input
                  {...p}
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'sign-up' ? 8 : undefined}
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-faint hover:text-ink"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            )}
          </Field>
        )}

        {error && <p role="alert" className="border-l-2 border-signal bg-canvas px-3 py-2 text-sm text-signal">{error}</p>}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
          {pending ? 'One moment…' : mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'}
        </Button>
        {mode === 'forgot' && (
          <Button variant="ghost" className="w-full" onClick={() => setMode('sign-in')}>Back to sign in</Button>
        )}
      </form>

      {mode !== 'forgot' && googleSignIn && (
        <>
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" /> <span className="hint">or</span> <span className="h-px flex-1 bg-line" />
          </div>
          <Button size="lg" className="w-full" onClick={google}>
            <GoogleMark /> Continue with Google
          </Button>
        </>
      )}
    </TitleScreen>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.24 1.4-1.7 4.1-5.4 4.1-3.25 0-5.9-2.7-5.9-6s2.65-6 5.9-6c1.85 0 3.1.8 3.8 1.45l2.6-2.5C16.75 3.6 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6-.06-1.1-.15-1.6H12Z" />
    </svg>
  )
}
