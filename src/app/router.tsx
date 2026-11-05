import { lazy, Suspense, type ComponentType } from 'react'
import { Outlet, ScrollRestoration, createBrowserRouter } from 'react-router'
import { Toaster } from 'sonner'
import { Tooltips } from '@/components/ui/Tooltips'
import { FullScreenLoader } from '@/components/ui/tokens'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { useAuth } from '@/features/auth/AuthProvider'
import NotFound, { RouteError } from '@/pages/NotFoundPage'

// Every page is its own chunk: players opening a share link never download the DM screen.
const Landing = lazy(() => import('@/pages/LandingPage'))
const Dashboard = lazy(() => import('@/pages/DashboardPage'))
const PlayerHome = lazy(() => import('@/pages/PlayerHomePage'))
const Campaign = lazy(() => import('@/pages/CampaignPage'))
const Join = lazy(() => import('@/pages/JoinPage'))
const PlayerEncounter = lazy(() => import('@/pages/PlayerEncounterPage'))
const Login = lazy(() => import('@/pages/LoginPage'))
const ResetPassword = lazy(() => import('@/pages/ResetPasswordPage'))
const Encounter = lazy(() => import('@/pages/EncounterPage'))
const Preset = lazy(() => import('@/pages/PresetPage'))
const Play = lazy(() => import('@/pages/PlayPage'))
const Demo = lazy(() => import('@/pages/DemoPage'))
const DemoPlay = lazy(() => import('@/pages/DemoPlayPage'))
const Account = lazy(() => import('@/pages/AccountPage'))
const Privacy = lazy(() => import('@/pages/LegalPage').then((m) => ({ default: m.PrivacyPage })))
const Terms = lazy(() => import('@/pages/LegalPage').then((m) => ({ default: m.TermsPage })))

function RootLayout() {
  return (
    <>
      <Suspense fallback={<FullScreenLoader />}>
        <Outlet />
      </Suspense>
      <ScrollRestoration />
      <Tooltips />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'bg-dnd-card! text-dnd-parchment! border! border-dnd-border! rounded-xl! shadow-card! font-body!',
            title: 'tracking-wide!',
            description: 'text-dnd-muted! font-ui! italic!',
          },
        }}
      />
    </>
  )
}

/** Signed in, home is whichever side of the table you were on last. */
function Home() {
  const { user, loading, mode } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Landing />
  return mode === 'player' ? <PlayerHome /> : <Dashboard />
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
      { path: '/encounters/:id/view', element: authed(PlayerEncounter) },
      { path: '/presets/:id', element: authed(Preset) },
      { path: '/campaigns/:id', element: authed(Campaign) },
      { path: '/join/:token', element: authed(Join) },
      { path: '/play/:token', element: <Play /> },
      { path: '/demo', element: <Demo /> },
      { path: '/demo/play', element: <DemoPlay /> },
      { path: '/account', element: authed(Account) },
      { path: '/privacy', element: <Privacy /> },
      { path: '/terms', element: <Terms /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
