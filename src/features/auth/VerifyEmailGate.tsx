import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { MailCheck, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { MessageScreen } from '@/components/ui/Scene'
import { api } from '@/lib/api'
import { CONTACT_EMAIL } from '@/lib/legal'
import { useAuth } from './AuthProvider'

const RESEND_WAIT_SECONDS = 60

/**
 * What an unconfirmed account sees in place of the app: where the email went,
 * a way to send it again, and a check for when it's been opened elsewhere.
 */
export function VerifyEmailGate() {
  const { user, refresh, signOut } = useAuth()
  const [wait, setWait] = useState(0)
  const [sending, setSending] = useState(false)

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

  async function resend() {
    setSending(true)
    try {
      await api.post('auth/verify/resend')
      toast.success('Sent again', { description: `Check ${user?.email}, and its spam folder.` })
      setWait(RESEND_WAIT_SECONDS)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t send the email')
    } finally {
      setSending(false)
    }
  }

  return (
    <MessageScreen
      icon={<MailCheck className="h-12 w-12 text-dnd-jade" />}
      title="Confirm your email"
      body={
        <div className="space-y-3">
          <p>
            We sent a link to <span className="text-dnd-parchment">{user?.email}</span>. Open it to start using Karsus. It works once, for 48 hours.
          </p>
          <p className="text-sm italic">
            Not there? Check your spam or promotions folder; it comes from a “no-reply” Azure address.
            {CONTACT_EMAIL && (
              <>
                {' '}
                Still stuck? Write to <a href={`mailto:${CONTACT_EMAIL}`} className="text-dnd-jade underline">{CONTACT_EMAIL}</a>.
              </>
            )}
          </p>
        </div>
      }
      actions={
        <>
          <button type="button" className="dnd-button-primary" onClick={() => void refresh()} title="Confirmed it on another device? This checks again.">
            <RefreshCw className="h-4 w-4" /> I’ve confirmed it
          </button>
          <button type="button" className="dnd-button-secondary" onClick={resend} disabled={sending || wait > 0} title="Sends a new link. Older links stop working once you use any of them.">
            {wait > 0 ? `Send again in ${wait}s` : sending ? 'Sending…' : 'Send it again'}
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
