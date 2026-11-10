import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ApiError, NotFoundError } from '@/lib/api'
import { applyTheme, savedTheme } from '@/lib/theme'
import { applyDisplay, savedDisplay } from '@/lib/display'
import { router } from '@/app/router'
import '@/styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // "Not yours" or "not found" won't change on a second try; a flaky connection might.
      retry: (failures, error) => failures < 1 && !(error instanceof NotFoundError) && !(error instanceof ApiError && error.status < 500 && error.status !== 0),
    },
  },
})

// Before the first render, so the page never flashes in the wrong colours.
applyTheme(savedTheme())
applyDisplay(savedDisplay())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
