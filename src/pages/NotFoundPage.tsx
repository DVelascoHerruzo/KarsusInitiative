import { isRouteErrorResponse, useRouteError } from 'react-router'
import { TitleScreen } from '@/components/layout/TitleScreen'
import { Button, ButtonLink } from '@/components/ui/Button'

export default function NotFoundPage() {
  return (
    <TitleScreen
      title={
        <>
          A natural
          <br />1
        </>
      }
      lede="That page doesn’t exist, or it rolled off the table."
      actions={
        <ButtonLink to="/" variant="primary" size="lg">
          Go home
        </ButtonLink>
      }
    />
  )
}

/** Route-level error boundary: a crash in one page never blanks the whole app. */
export function RouteError() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  console.error(error)
  return (
    <TitleScreen
      title={
        <>
          Something
          <br />
          broke
        </>
      }
      lede="An unexpected error stopped this page. Reloading usually fixes it, and your data is safe on the server."
      actions={
        <>
          <Button variant="primary" size="lg" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <ButtonLink to="/" size="lg">
            Go home
          </ButtonLink>
        </>
      }
    />
  )
}
