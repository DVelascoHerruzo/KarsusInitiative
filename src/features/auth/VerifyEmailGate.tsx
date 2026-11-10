import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { MailCheck, MailWarning, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { MessageScreen } from '@/components/ui/Scene'
import { api } from '@/lib/api'
import { CONTACT_EMAIL } from '@/lib/legal'
import type { User } from '@/lib/types'
import { useAuth } from './AuthProvider'

const RESEND_WAIT_SECONDS = 60

type Status = { state: 'sending' } | { state: 'sent'; at: string } | { state: 'failed'; error: string } | { state: 'unsent' }

const statusOf = (user: User | null): Status => (user?.verification_sent_at ? { state: 'sent', at: user.verification_sent_at } : { state: 'unsent' })

/**
 * What an unconfirmed account sees in place of the app. It only says an email
 * was sent when the server says one went out; an account that never got one
 * (made before confirmation existed, or when sending failed) gets one now.
 */
export function VerifyEmailGate() {
  const { user, refresh, signOut, updateUser } = useAuth()
  const [status, setStatus] = useState<Status>(() => statusOf(user))
  const [wait, setWait] = useState(0)
  const autoSent = useRef(false)

  async function send(again = false) {
    setStatus({ state: 'sending' })
    try {
      const { user: updated } = await api.post<{ user: User }>('auth/verify/resend')
      updateUser(updated)
      setStatus(statusOf(updated))
      setWait(RESEND_WAIT_SECONDS)
      if (again) toast.success('Sent again', { description: 'Open the newest email.' })
    } catch (err) {
      setStatus({ state: 'failed', error: err instanceof Error ? err.message : 'We couldn’t send the email.' })
    }
  }

  // Nothing was ever sent to this account: send it now rather than pretend.
  useEffect(() => {
    if (status.state !== 'unsent' || autoSent.current) return
    autoSent.current = true
    void send()
  })

  // Opened the link on a phone? Coming back to this tab picks that up.
  useEffect(() => {
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const email = <span className="text-dnd-parchment">{user?.email}</span>
  const support = CONTACT_EMAIL && (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-dnd-jade underline">
      {CONTACT_EMAIL}
    </a>
  )

  let message
  if (status.state === 'sent') {
    const time = new Date(status.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    message = (
      <>
        <p>
          We sent a link to {email} at {time}. Open it to start using Karsus. It works once, for 48 hours.
        </p>
        <p className="text-sm italic">
          It can take a minute or two to arrive. Not there? Check your spam or promotions folder for an email from no-reply@karsusinitiative.com
          {support && <>, or write to {support}</>}.
        </p>
      </>
    )
  } else if (status.state === 'failed') {
    message = (
      <p role="alert" className="text-red-300">
        We couldn’t send the email to {email}. {status.error}
      </p>
    )
  } else {
    message = <p aria-live="polite">Sending a confirmation link to {email}…</p>
  }

  return (
    <MessageScreen
      icon={status.state === 'failed' ? <MailWarning className="h-12 w-12 text-dnd-red" /> : <MailCheck className="h-12 w-12 text-dnd-jade" />}
      title="Confirm your email"
      body={<div className="space-y-3">{message}</div>}
      actions={
        <>
          {status.state === 'sent' && (
            <button type="button" className="dnd-button-primary" onClick={() => void refresh()} title="Confirmed it on another device? This checks again.">
              <RefreshCw className="h-4 w-4" /> I’ve confirmed it
            </button>
          )}
          <button
            type="button"
            className={status.state === 'failed' ? 'dnd-button-primary' : 'dnd-button-secondary'}
            onClick={() => void send(status.state === 'sent')}
            disabled={status.state === 'sending' || wait > 0}
            title="Sends a new link to your inbox."
          >
            {status.state === 'sending' ? 'Sending…' : wait > 0 ? `Send again in ${wait}s` : status.state === 'failed' ? 'Try again' : 'Send it again'}
          </button>
          <div className="flex w-full justify-center gap-4 pt-2 font-ui text-sm">
            <Link to="/account" className="text-dnd-muted underline hover:text-dnd-parchment" title="Wrong email? Delete this account and sign up again.">
              Account settings
            </Link>
            <button type="button" className="text-dnd-muted underline hover:text-dnd-parchment" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </>
      }
    />
  )
}
