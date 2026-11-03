import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FullScreenLoader } from '@/components/ui/tokens'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
