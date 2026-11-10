import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, isBackendConfigured } from '@/lib/api'
import type { Mode, User } from '@/lib/types'

interface AuthState {
  user: User | null
  /** Display name: the account's username, falling back to the email prefix. */
  displayName: string
  loading: boolean
  /** Whether the server offers "Continue with Google". */
  googleSignIn: boolean
  /** Signed in, but hasn't opened the link in their verification email yet. */
  needsVerification: boolean
  /** Asks the server again who's signed in: after confirming the email on another device, say. */
  refresh: () => Promise<void>
  /** Takes a newer copy of the same account from the server (no cache clearing, unlike signedIn). */
  updateUser: (user: User) => void
  /** Which side of the table the app opens on. Remembered on the account, so every device agrees. */
  mode: Mode
  setMode: (mode: Mode) => void
  /** Called by the sign-in forms with the account the API just signed in. */
  signedIn: (user: User) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isBackendConfigured)
  const [googleSignIn, setGoogleSignIn] = useState(false)
  const [verificationRequired, setVerificationRequired] = useState(false)

  /** Asks the server who's signed in. No API reachable (offline, or a local build without it): signed out. */
  const load = useCallback(
    () =>
      api
        .get<{ user: User | null; google: boolean; verification: boolean }>('auth/me')
        .then((me) => {
          setUser(me.user)
          setGoogleSignIn(me.google)
          setVerificationRequired(me.verification)
        })
        .catch(() => setUser(null))
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    if (isBackendConfigured) void load()
  }, [load])

  const refresh = useCallback(async () => {
    if (isBackendConfigured) await load()
  }, [load])

  const signedIn = useCallback(
    (next: User) => {
      // Never show one account's cached data to the next one on a shared device.
      qc.clear()
      setUser(next)
    },
    [qc],
  )

  const setMode = useCallback((mode: Mode) => {
    // Switch at once; saving it is only so the next visit opens on the same side.
    setUser((u) => (u ? { ...u, mode } : u))
    api.patch('auth/me', { mode }).catch(() => {})
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      displayName: user?.username || user?.email.split('@')[0] || 'Adventurer',
      loading,
      googleSignIn,
      needsVerification: Boolean(user && verificationRequired && !user.email_verified),
      refresh,
      updateUser: setUser,
      mode: user?.mode ?? 'dm',
      setMode,
      signedIn,
      signOut: async () => {
        await api.post('auth/signout')
        qc.clear()
        setUser(null)
      },
    }),
    [user, loading, googleSignIn, verificationRequired, refresh, setMode, signedIn, qc],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
