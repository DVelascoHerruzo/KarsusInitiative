import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { Dices, Skull } from 'lucide-react'
import { MessageScreen } from '@/components/ui/Scene'

export default function NotFoundPage() {
  return (
    <MessageScreen
      icon={<Dices className="h-12 w-12 text-dnd-jade" />}
      title="A natural 1"
      body="That page doesn’t exist, or it rolled off the table."
      actions={
        <Link to="/" className="dnd-button-primary">
          Go home
        </Link>
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
    <MessageScreen
      icon={<Skull className="h-12 w-12 text-dnd-red" />}
      title="Something broke"
      body="An unexpected error stopped this page. Reloading usually fixes it, and your data is safe on the server."
      actions={
        <>
          <button type="button" className="dnd-button-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <Link to="/" className="dnd-button-secondary">
            Go home
          </Link>
        </>
      }
    />
  )
}
