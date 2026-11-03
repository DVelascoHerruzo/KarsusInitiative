import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Crown, LinkIcon } from 'lucide-react'
import Layout, { PageHeader } from '@/components/ui/Layout'
import { MessageScreen } from '@/components/ui/Scene'
import { FullScreenLoader } from '@/components/ui/tokens'
import { useAuth } from '@/features/auth/AuthProvider'
import { CharacterPicker } from '@/features/characters/CharacterPicker'
import { CharacterSheetDialog } from '@/features/characters/CharacterSheetDialog'
import { NotFoundError } from '@/features/encounters/queries'
import { useAcceptInvite, useInvite } from '@/features/player/queries'
import { uploadImage } from '@/lib/images'
import type { CharacterChoice, InvitePreview } from '@/lib/types'

/** Where a joined table opens: the DM screen for co-DMs, the player side for players. */
function destination(kind: InvitePreview['kind'], id: string, role: string) {
  if (role === 'player') return kind === 'campaign' ? `/campaigns/${id}` : `/encounters/${id}/view`
  return kind === 'campaign' ? `/presets/${id}` : `/encounters/${id}`
}

export default function JoinPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { setMode } = useAuth()
  const { data: invite, isPending, error } = useInvite(token)
  const accept = useAcceptInvite(token)
  const [creating, setCreating] = useState(false)

  if (isPending) return <FullScreenLoader label="Opening the invite…" />

  if (error || !invite) {
    return (
      <MessageScreen
        icon={<LinkIcon className="h-12 w-12 text-dnd-muted" />}
        title="This invite has closed"
        body={error instanceof NotFoundError ? 'The DM may have made a new link or switched this one off. Ask them for a fresh one.' : error?.message}
        actions={
          <Link to="/" className="dnd-button-primary">
            Go to Karsus
          </Link>
        }
      />
    )
  }

  const what = invite.kind === 'campaign' ? 'campaign' : 'encounter'

  async function join(choice: CharacterChoice | Record<string, never>) {
    const joined = await accept.mutateAsync(choice)
    setMode(joined.role === 'player' ? 'player' : 'dm')
    navigate(destination(joined.kind, joined.id, joined.role), { replace: true })
  }
  const tryJoin = (choice: CharacterChoice | Record<string, never>) => void join(choice).catch(() => {})

  const already = invite.current !== null && (invite.current !== 'player' || invite.role === 'player')

  return (
    <Layout title="Invitation">
      <title>{`Join ${invite.name} · Karsus`}</title>
      {invite.background_url && (
        <div className="pointer-events-none fixed inset-0 z-0 bg-dnd-black">
          <img src={invite.background_url} alt="" className="h-full w-full object-cover opacity-[0.2]" />
          <div className="absolute inset-0 bg-gradient-to-b from-dnd-black/50 via-transparent to-dnd-black/70" />
        </div>
      )}

      <div className="relative z-10 space-y-6">
        <PageHeader
          back={{ to: '/', label: 'Home' }}
          eyebrow={`${invite.role === 'dm' ? 'Co-DM' : 'Player'} invitation · ${invite.kind}`}
          title={invite.name}
          description={invite.description}
        />

        {already ? (
          <div className="dnd-card max-w-xl p-6">
            <h2 className="font-body text-lg tracking-widest text-dnd-gold uppercase">{invite.current === 'owner' ? `This is your own ${what}` : 'You’re already in'}</h2>
            <Link
              to={destination(invite.kind, invite.id, invite.current === 'owner' ? 'dm' : invite.current!)}
              className="dnd-button-primary mt-4"
              onClick={() => setMode(invite.current === 'player' ? 'player' : 'dm')}
            >
              Open the {what}
            </Link>
          </div>
        ) : invite.role === 'dm' ? (
          <div className="dnd-card max-w-xl space-y-4 p-6">
            <p className="font-ui text-lg text-dnd-parchment">
              <span className="text-dnd-gold">{invite.dm_name}</span> invited you to run this {what} with them. As a co-DM you can change everything: creatures,
              turns, who’s invited. Only {invite.dm_name} can delete it.
            </p>
            <button type="button" className="dnd-button-primary" disabled={accept.isPending} onClick={() => tryJoin({})}>
              <Crown className="h-4 w-4" /> Join as Co-DM
            </button>
          </div>
        ) : (
          <section aria-labelledby="pick" className="space-y-4">
            <div className="dnd-card p-5">
              <h2 id="pick" className="font-body text-lg tracking-widest text-dnd-gold uppercase">
                Choose your character
              </h2>
              <p className="mt-1 max-w-3xl font-ui text-dnd-muted italic">
                {invite.dm_name} invited you to play in this {what}.{' '}
                {invite.kind === 'campaign'
                  ? 'Your character is yours to keep up to date as it grows, and every fight the DM opens from this campaign appears on your side.'
                  : 'You’ll follow the fight on the visual view and can update your own HP and conditions.'}
              </p>
            </div>
            <CharacterPicker characters={invite.characters} pending={accept.isPending} onClaim={(id) => tryJoin({ claim: id })} onCreate={() => setCreating(true)} />
            {invite.kind === 'campaign' && (
              <button type="button" disabled={accept.isPending} onClick={() => tryJoin({})} className="dnd-button-ghost px-3 text-sm">
                Join now, choose later
              </button>
            )}
          </section>
        )}
      </div>

      <CharacterSheetDialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Your Character"
        submitLabel="Join With This Character"
        askInitiative={invite.kind === 'encounter'}
        upload={uploadImage}
        onSubmit={(draft) => join({ create: { ...draft, is_player: true } })}
      />
    </Layout>
  )
}
