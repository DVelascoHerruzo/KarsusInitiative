import { lazy, Suspense, type ComponentType } from 'react'
import { Outlet, ScrollRestoration, createBrowserRouter } from 'react-router'
import { Toaster } from 'sonner'
import { PageLoader } from '@/components/ui/display'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { useAuth } from '@/features/auth/AuthProvider'
import NotFound, { RouteError } from '@/pages/NotFoundPage'

// Every page is its own chunk: players opening a share link never download the DM screen.
const Landing = lazy(() => import('@/pages/LandingPage'))
const Dashboard = lazy(() => import('@/pages/DashboardPage'))
const Login = lazy(() => import('@/pages/LoginPage'))
const ResetPassword = lazy(() => import('@/pages/ResetPasswordPage'))
const Encounter = lazy(() => import('@/pages/EncounterPage'))
const Preset = lazy(() => import('@/pages/PresetPage'))
const Play = lazy(() => import('@/pages/PlayPage'))
const Demo = lazy(() => import('@/pages/DemoPage'))
const DemoPlay = lazy(() => import('@/pages/DemoPlayPage'))

function RootLayout() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
      <ScrollRestoration />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'bg-raised! text-ink! border-0! border-l-2! border-signal! rounded-none! shadow-none! font-sans!',
            title: 'cmd text-sm!',
            description: 'text-ink-muted!',
          },
        }}
      />
    </>
  )
}

function Home() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return user ? <Dashboard /> : <Landing />
}

const authed = (Page: ComponentType) => (
  <RequireAuth>
    <Page />
  </RequireAuth>
)

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/login', element: <Login /> },
      { path: '/reset-password', element: <ResetPassword /> },
      { path: '/encounters/:id', element: authed(Encounter) },
      { path: '/presets/:id', element: authed(Preset) },
      { path: '/play/:token', element: <Play /> },
      { path: '/demo', element: <Demo /> },
      { path: '/demo/play', element: <DemoPlay /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
