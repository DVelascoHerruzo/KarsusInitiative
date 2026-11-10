import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FullScreenLoader } from '@/components/ui/tokens'
import { useAuth } from './AuthProvider'
import { VerifyEmailGate } from './VerifyEmailGate'

/** Signed in, and (unless `allowUnverified`) with the email confirmed. */
export function RequireAuth({ children, allowUnverified }: { children: ReactNode; allowUnverified?: boolean }) {
  const { user, loading, needsVerification } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (needsVerification && !allowUnverified) return <VerifyEmailGate />
  return children
}
