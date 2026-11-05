import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { DoorClosed } from 'lucide-react'
import { MessageScreen } from '@/components/ui/Scene'
import { FullScreenLoader } from '@/components/ui/tokens'
import { keys, useEncounterPings, useSharedEncounter } from '@/features/encounters/queries'
import { DisplayView } from '@/features/play/DisplayView'

/** The display window from the share link: no account needed, read-only. */
export default function PlayPage() {
  const { token = '' } = useParams()
  const qc = useQueryClient()
  const { data, isPending, isError } = useSharedEncounter(token)
  useEncounterPings(token, () => qc.invalidateQueries({ queryKey: keys.shared(token) }))

  if (isPending) return <FullScreenLoader label="Entering the battlefield…" />

  if (isError || !data) {
    return (
      <MessageScreen
        icon={<DoorClosed className="h-12 w-12 text-dnd-muted" />}
        title="This table is closed"
        body={isError ? 'We couldn’t reach the table. Check your connection and refresh.' : 'The link may be wrong, or your DM has turned off the player view.'}
        actions={
          <Link to="/" className="dnd-button-primary">
            Go to Karsus
          </Link>
        }
      />
    )
  }

  return (
    <>
      <title>{`${data.title} · Karsus`}</title>
      <DisplayView encounter={data} />
    </>
  )
}
