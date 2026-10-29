import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { TitleScreen } from '@/components/layout/TitleScreen'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useAuth } from '@/features/auth/AuthProvider'
import { api } from '@/lib/api'
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

  return token ? (
    <TitleScreen
      title={
        <>
          New
          <br />
          password
        </>
      }
      lede="Choose a new password for your account."
    >
      <title>New password · Karsus</title>
      <form onSubmit={submit} className="space-y-5">
        <Field label="New password" hint="At least 8 characters." error={error ?? undefined}>
          {(p) => (
            <Input {...p} type="password" required minLength={8} autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </TitleScreen>
  ) : (
    <TitleScreen
      title={
        <>
          Link
          <br />
          expired
        </>
      }
      lede="Reset links work once and only for an hour. Request a new one from the sign-in page."
      actions={
        <ButtonLink to="/login" variant="primary" size="lg">
          Back to sign in
        </ButtonLink>
      }
    >
      <title>New password · Karsus</title>
    </TitleScreen>
  )
}
