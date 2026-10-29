import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, isBackendConfigured } from '@/lib/api'
import type { User } from '@/lib/types'

interface AuthState {
  user: User | null
  /** Display name: the account's username, falling back to the email prefix. */
  displayName: string
  loading: boolean
  /** Whether the server offers "Continue with Google". */
  googleSignIn: boolean
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

  useEffect(() => {
    if (!isBackendConfigured) return
    api
      .get<{ user: User | null; google: boolean }>('auth/me')
      .then(({ user, google }) => {
        setUser(user)
        setGoogleSignIn(google)
      })
      // No API reachable (offline, or a local build without it): treat as signed out.
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const signedIn = useCallback(
    (next: User) => {
      // Never show one account's cached data to the next one on a shared device.
      qc.clear()
      setUser(next)
    },
    [qc],
  )

  const value = useMemo<AuthState>(
    () => ({
      user,
      displayName: user?.username || user?.email.split('@')[0] || 'Adventurer',
      loading,
      googleSignIn,
      signedIn,
      signOut: async () => {
        await api.post('auth/signout')
        qc.clear()
        setUser(null)
      },
    }),
    [user, loading, googleSignIn, signedIn, qc],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
