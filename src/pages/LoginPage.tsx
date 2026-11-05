import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Eye, EyeOff, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { CenterScene, MessageScreen } from '@/components/ui/Scene'
import { FullScreenLoader } from '@/components/ui/tokens'
import { useAuth } from '@/features/auth/AuthProvider'
import { api, isBackendConfigured } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useTealTheme } from '@/lib/theme'
import type { User } from '@/lib/types'

type Mode = 'login' | 'register' | 'forgot'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  useTealTheme()

  if (loading) return <FullScreenLoader />
  if (user) return <Navigate to={from} replace />
  if (!isBackendConfigured) {
    return (
      <MessageScreen
        title="Accounts aren’t set up here"
        body="This build runs without the accounts API. You can still try everything in the demo."
        actions={
          <Link to="/demo" className="dnd-button-primary">
            Open the demo
          </Link>
        }
      />
    )
  }
  return <AuthForm next={from} initial={(location.state as { mode?: string } | null)?.mode === 'register' ? 'register' : 'login'} />
}

function AuthForm({ next, initial }: { next: string; initial: Mode }) {
  const navigate = useNavigate()
  const { signedIn, googleSignIn } = useAuth()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(initial)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  // The Google callback sends people back here with ?error=google when it can't finish.
  const [error, setError] = useState<string | null>(
    params.get('error') === 'google' ? 'Google sign-in didn’t finish. Try again, or use your email and password.' : null,
  )
  const [sentTo, setSentTo] = useState<string | null>(null)

  const mismatch = mode === 'register' && confirm !== '' && confirm !== password

  function switchTo(m: Mode) {
    setMode(m)
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (mismatch) return
    setLoading(true)
    setError(null)
    try {
      if (mode === 'login') {
        const { user } = await api.post<{ user: User }>('auth/signin', { email, password })
        signedIn(user)
        toast.success('Welcome back, adventurer!')
        navigate(next, { replace: true })
      } else if (mode === 'register') {
        const { user } = await api.post<{ user: User }>('auth/signup', { email, password, username: username.trim() })
        signedIn(user)
        toast.success('Your legend begins!')
        navigate(next, { replace: true })
      } else {
        await api.post('auth/forgot', { email })
        setSentTo(email)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (sentTo) {
    return (
      <MessageScreen
        icon={<MailCheck className="h-12 w-12 text-dnd-jade" />}
        title="Check your inbox"
        body={
          <p role="status">
            If there’s an account for <span className="text-dnd-parchment">{sentTo}</span>, a password reset link is on its way. It works for one hour.
          </p>
        }
        actions={
          <button
            type="button"
            className="dnd-button-secondary"
            onClick={() => {
              setSentTo(null)
              switchTo('login')
            }}
          >
            Back to sign in
          </button>
        }
      />
    )
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => switchTo(m)}
      className={cn(
        'flex-1 pb-3 font-body text-sm tracking-widest uppercase transition-colors',
        mode === m ? '-mb-px border-b-2 border-dnd-jade text-dnd-jade' : 'text-dnd-muted hover:text-dnd-parchment',
      )}
    >
      {label}
    </button>
  )

  return (
    <CenterScene>
      <title>{mode === 'register' ? 'Create account · Karsus' : 'Sign in · Karsus'}</title>
      <div className="dnd-card p-8">
        {mode === 'forgot' ? (
          <div className="mb-6">
            <h1 className="font-body text-sm tracking-widest text-dnd-jade uppercase">Reset your password</h1>
            <p className="mt-1 font-ui text-sm text-dnd-muted italic">We’ll email you a link to choose a new one.</p>
          </div>
        ) : (
          <div role="tablist" aria-label="Account" className="mb-8 flex border-b border-dnd-border">
            {tab('login', 'Sign In')}
            {tab('register', 'Create Account')}
          </div>
        )}

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="auth-email" className="dnd-label">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              placeholder="adventurer@realm.com"
              className="dnd-input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="auth-username" className="dnd-label">
                Username
              </label>
              <input
                id="auth-username"
                required
                minLength={1}
                maxLength={40}
                placeholder="TheLegendaryDM"
                className="dnd-input"
                autoComplete="nickname"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="auth-password" className="dnd-label">
                  Password
                </label>
                {mode === 'login' && (
                  <button type="button" onClick={() => switchTo('forgot')} className="font-ui text-xs text-dnd-muted italic hover:text-dnd-jade">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                  placeholder="••••••••"
                  className="dnd-input pr-10"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-dnd-muted hover:text-dnd-parchment"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'register' && (
                <p className="mt-1 font-ui text-xs text-dnd-muted italic">At least 8 characters. A long phrase is best; passwords from known data breaches are refused.</p>
              )}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label htmlFor="auth-confirm" className="dnd-label">
                Confirm Password
              </label>
              <input
                id="auth-confirm"
                type={showPass ? 'text' : 'password'}
                required
                placeholder="••••••••"
                className="dnd-input"
                autoComplete="new-password"
                aria-invalid={mismatch ? true : undefined}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {mismatch && <p className="mt-1 text-xs text-red-400">Passwords do not match</p>}
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-dnd-crimson/60 bg-dnd-crimson/15 px-3 py-2 font-ui text-sm text-red-300">
              {error}
            </p>
          )}

          {mode === 'register' && (
            <p className="font-ui text-xs text-dnd-muted italic">
              By creating an account you agree to the{' '}
              <Link to="/terms" className="text-dnd-jade underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-dnd-jade underline">
                Privacy Policy
              </Link>
              .
            </p>
          )}

          <button type="submit" disabled={loading || mismatch} className="dnd-button-primary mt-2 w-full">
            {mode === 'login'
              ? loading
                ? 'Entering the Realm…'
                : 'Enter the Realm'
              : mode === 'register'
                ? loading
                  ? 'Forging Legend…'
                  : 'Begin Your Legend'
                : loading
                  ? 'Sending…'
                  : 'Send Reset Link'}
          </button>
          {mode === 'forgot' && (
            <button type="button" className="dnd-button-ghost w-full" onClick={() => switchTo('login')}>
              Back to sign in
            </button>
          )}
        </form>

        {mode !== 'forgot' && googleSignIn && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-dnd-border" />
              <span className="font-ui text-xs tracking-wider text-dnd-muted">OR</span>
              <div className="h-px flex-1 bg-dnd-border" />
            </div>
            <button
              type="button"
              // A full-page trip through Google; the API sets the session cookie and sends us back.
              onClick={() => window.location.assign(`/api/auth/google?next=${encodeURIComponent(next)}`)}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-dnd-border bg-black/60 px-4 py-2.5 font-body text-sm tracking-wider text-dnd-parchment transition-colors hover:border-dnd-jade"
            >
              <GoogleMark /> Continue with Google
            </button>
          </div>
        )}
      </div>
    </CenterScene>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.24 1.4-1.7 4.1-5.4 4.1-3.25 0-5.9-2.7-5.9-6s2.65-6 5.9-6c1.85 0 3.1.8 3.8 1.45l2.6-2.5C16.75 3.6 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6-.06-1.1-.15-1.6H12Z"
      />
    </svg>
  )
}
