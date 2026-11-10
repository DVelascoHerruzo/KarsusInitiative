import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { MailX } from 'lucide-react'
import { toast } from 'sonner'
import { MessageScreen } from '@/components/ui/Scene'
import { FullScreenLoader } from '@/components/ui/tokens'
import { useAuth } from '@/features/auth/AuthProvider'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'

/** Where the link in the verification email lands: confirms the address and signs this device in. */
export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { signedIn } = useAuth()
  const [error, setError] = useState<string | null>(token ? null : 'This link is missing its code. Open it straight from the email.')
  const started = useRef(false)

  useEffect(() => {
    // Once, even in React's development double-run: the link only works once.
    if (!token || started.current) return
    started.current = true
    api
      .post<{ user: User }>('auth/verify', { token })
      .then(({ user }) => {
        signedIn(user)
        toast.success('Email confirmed', { description: 'Welcome to the table!' })
        navigate('/', { replace: true })
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Couldn’t confirm your email'))
  }, [token, signedIn, navigate])

  if (!error) return <FullScreenLoader label="Confirming your email…" />
  return (
    <MessageScreen
      icon={<MailX className="h-12 w-12 text-dnd-red" />}
      title="That link didn’t work"
      body={error}
      actions={
        <Link to="/" className="dnd-button-primary">
          Go to Karsus
        </Link>
      }
    />
  )
}
