import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { PageLoader } from '@/components/ui/display'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
