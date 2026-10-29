import { useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { TitleScreen } from '@/components/layout/TitleScreen'
import { ButtonLink } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/display'
import { keys, useEncounterPings, useSharedEncounter } from '@/features/encounters/queries'
import { PlayerBoard } from '@/features/play/PlayerBoard'

export default function PlayPage() {
  const { token = '' } = useParams()
  const qc = useQueryClient()
  const { data, isPending, isError } = useSharedEncounter(token)
  useEncounterPings(token, () => qc.invalidateQueries({ queryKey: keys.shared(token) }))

  if (isPending) return <PageLoader label="Entering the battlefield" />

  if (isError || !data) {
    return (
      <TitleScreen
        title={
          <>
            This table
            <br />
            is closed
          </>
        }
        lede={
          isError
            ? 'We couldn’t reach the table. Check your connection and refresh.'
            : 'The link may be wrong, or your DM has turned off the player view.'
        }
        actions={<ButtonLink to="/">Go to Karsus</ButtonLink>}
      />
    )
  }

  return <PlayerBoard encounter={data} />
}
