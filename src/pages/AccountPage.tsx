import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Download, KeyRound, LogOut, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Layout, { PageHeader } from '@/components/ui/Layout'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/features/auth/AuthProvider'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'

/** Looking after your account: password, devices, your data, and leaving for good. */
export default function AccountPage() {
  const { user, signedIn } = useAuth()
  if (!user) return null
  return (
    <Layout title="Account & Security">
      <title>Account &amp; Security · Karsus</title>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader back={{ to: '/', label: 'Back' }} eyebrow={user.email} title="Account & Security" />
        <PasswordSection user={user} onSaved={signedIn} />
        <DevicesSection />
        <DataSection />
        <DeleteSection user={user} />
      </div>
    </Layout>
  )
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="dnd-card space-y-3 p-5">
      <h2 className="flex items-center gap-2 font-body text-lg tracking-widest text-dnd-parchment uppercase">
        {icon} {title}
      </h2>
      {children}
    </section>
  )
}

function PasswordSection({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const has = user.sign_in.password
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      const { user: updated } = await api.post<{ user: User }>('auth/password', { current, password: next })
      onSaved(updated)
      setCurrent('')
      setNext('')
      toast.success(has ? 'Password changed' : 'Password added', { description: 'Your other devices have been signed out.' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t change the password')
    } finally {
      setPending(false)
    }
  }

  return (
    <Section icon={<KeyRound className="h-5 w-5 text-dnd-jade" />} title={has ? 'Password' : 'Add a password'}>
      <p className="font-ui text-sm text-dnd-muted italic">
        {has
          ? 'Use at least 8 characters. A long phrase is easier to remember and harder to guess. Passwords found in known data breaches are refused.'
          : 'You sign in with Google. Add a password to sign in with your email too.'}
      </p>
      <form onSubmit={submit} className="space-y-3">
        {has && (
          <div>
            <label htmlFor="current-password" className="dnd-label">
              Current password
            </label>
            <input id="current-password" type="password" autoComplete="current-password" className="dnd-input" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
        )}
        <div>
          <label htmlFor="new-password" className="dnd-label">
            New password
          </label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={8} className="dnd-input" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <button type="submit" className="dnd-button-primary" disabled={pending || next.length < 8 || (has && !current)}>
          {pending ? 'Saving…' : has ? 'Change Password' : 'Add Password'}
        </button>
      </form>
    </Section>
  )
}

function DevicesSection() {
  const [pending, setPending] = useState(false)
  return (
    <Section icon={<LogOut className="h-5 w-5 text-dnd-jade" />} title="Other devices">
      <p className="font-ui text-sm text-dnd-muted italic">
        You stay signed in on each device for a year after your last visit. Lost a phone, or used a shared computer? Sign out everywhere except here.
      </p>
      <button
        type="button"
        className="dnd-button-secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          try {
            await api.post('auth/signout-others')
            toast.success('Signed out everywhere else')
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Couldn’t sign out other devices')
          } finally {
            setPending(false)
          }
        }}
      >
        <LogOut className="h-4 w-4" /> Sign Out Other Devices
      </button>
    </Section>
  )
}

function DataSection() {
  const [pending, setPending] = useState(false)
  async function download() {
    setPending(true)
    try {
      // Built into a file here in the browser; nothing extra is stored on the server.
      const data = await api.get<unknown>('auth/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: `karsus-data-${new Date().toISOString().slice(0, 10)}.json` })
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t prepare your data')
    } finally {
      setPending(false)
    }
  }
  return (
    <Section icon={<Download className="h-5 w-5 text-dnd-jade" />} title="Your data">
      <p className="font-ui text-sm text-dnd-muted italic">
        A copy of everything Karsus stores about you, as a JSON file: your account, encounters, campaigns, characters and folders. Your password is never included.
      </p>
      <button type="button" className="dnd-button-secondary" onClick={download} disabled={pending}>
        <Download className="h-4 w-4" /> {pending ? 'Preparing…' : 'Download My Data'}
      </button>
    </Section>
  )
}

function DeleteSection({ user }: { user: User }) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const byPassword = user.sign_in.password

  async function remove(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      await api.request('DELETE', 'auth/account', byPassword ? { password: confirm } : { email: confirm })
      await signOut().catch(() => {})
      toast.success('Your account has been deleted')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t delete the account')
      setPending(false)
    }
  }

  return (
    <Section icon={<Trash2 className="h-5 w-5 text-dnd-red" />} title="Delete account">
      <p className="font-ui text-sm text-dnd-muted italic">
        Deletes your account, every encounter and campaign you own, and the images you uploaded. You leave every campaign you play in, and your characters there are freed
        for others. This can’t be undone, so download your data first if you want a copy.
      </p>
      <button type="button" className="dnd-button-danger" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" /> Delete My Account
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?" size="sm">
        <form onSubmit={remove} className="space-y-4 p-6">
          <p className="flex gap-2 font-ui text-sm text-dnd-parchment">
            <ShieldCheck className="h-5 w-5 shrink-0 text-dnd-red" /> Everything listed is deleted straight away and can’t be recovered.
          </p>
          <div>
            <label htmlFor="confirm-delete" className="dnd-label">
              {byPassword ? 'Your password' : 'Type your email to confirm'}
            </label>
            <input
              id="confirm-delete"
              data-autofocus
              type={byPassword ? 'password' : 'email'}
              autoComplete={byPassword ? 'current-password' : 'off'}
              className="dnd-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button type="button" className="dnd-button-secondary flex-1" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="dnd-button-danger flex-1" disabled={pending || !confirm}>
              {pending ? 'Deleting…' : 'Delete Forever'}
            </button>
          </div>
        </form>
      </Modal>
    </Section>
  )
}
