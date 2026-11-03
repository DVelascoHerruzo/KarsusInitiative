import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { CenterScene, MessageScreen } from '@/components/ui/Scene'
import { useAuth } from '@/features/auth/AuthProvider'
import { api } from '@/lib/api'
import { useTealTheme } from '@/lib/theme'
import type { User } from '@/lib/types'

/** Landing page for the emailed reset link, which carries a one-time token. */
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { signedIn } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useTealTheme()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const { user } = await api.post<{ user: User }>('auth/reset', { token, password })
      signedIn(user)
      toast.success('Password updated', { description: 'Other devices have been signed out.' })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPending(false)
    }
  }

  if (!token) {
    return (
      <MessageScreen
        title="Link expired"
        body="Reset links work once and only for an hour. Request a new one from the sign-in page."
        actions={
          <Link to="/login" className="dnd-button-primary">
            Back to sign in
          </Link>
        }
      />
    )
  }

  return (
    <CenterScene>
      <title>New password · Karsus</title>
      <div className="dnd-card p-8">
        <h1 className="mb-6 font-body text-sm tracking-widest text-dnd-jade uppercase">Choose a new password</h1>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="new-password" className="dnd-label">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
              placeholder="••••••••"
              className="dnd-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 font-ui text-xs text-dnd-muted italic">At least 8 characters.</p>
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-dnd-crimson/60 bg-dnd-crimson/15 px-3 py-2 font-ui text-sm text-red-300">
              {error}
            </p>
          )}
          <button type="submit" className="dnd-button-primary w-full" disabled={pending}>
            {pending ? 'Saving…' : 'Save Password'}
          </button>
        </form>
      </div>
    </CenterScene>
  )
}
