import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Link2, Scroll, Swords } from 'lucide-react'
import { toast } from 'sonner'
import { CardGrid, CardSkeletons, EmptyCard, EncounterGroups, Hero, SceneCard, SectionHeading } from '@/components/ui/Cards'
import Layout from '@/components/ui/Layout'
import { useAuth } from '@/features/auth/AuthProvider'
import { usePlayerHome } from '@/features/player/queries'
import { groupEncounters } from '@/lib/folders'

/** The token from an invite link, or from the bare token pasted on its own. */
function inviteToken(text: string): string | null {
  return /(?:\/join\/)?([0-9a-f]{32})\b/.exec(text.trim())?.[1] ?? null
}

export default function PlayerHomePage() {
  const { displayName } = useAuth()
  const navigate = useNavigate()
  const home = usePlayerHome()
  const [link, setLink] = useState('')

  function openInvite(e: FormEvent) {
    e.preventDefault()
    const token = inviteToken(link)
    if (!token) return toast.error('That doesn’t look like a Karsus invite link')
    navigate(`/join/${token}`)
  }

  const campaigns = home.data?.campaigns
  const encounters = home.data?.encounters

  return (
    <Layout>
      <title>Your adventures · Karsus</title>
      <div className="space-y-10">
        <Hero eyebrow="Adventurer’s Ledger" title={displayName.toUpperCase()} tagline="Your campaigns, your characters, your fights." />

        <form onSubmit={openInvite} className="dnd-card flex flex-wrap items-center gap-3 p-4">
          <label htmlFor="invite-link" className="flex items-center gap-2 font-body text-sm tracking-widest text-dnd-jade uppercase">
            <Link2 className="h-4 w-4" /> Join a table
          </label>
          <input
            id="invite-link"
            className="dnd-input min-w-0 flex-1 py-2"
            value={link}
            placeholder="Paste the invite link your DM sent you"
            onChange={(e) => setLink(e.target.value)}
          />
          <button type="submit" className="dnd-button-primary px-5 py-2" disabled={!link.trim()}>
            Join
          </button>
        </form>

        <section aria-label="Campaigns">
          <SectionHeading icon={<Scroll className="h-5 w-5 text-dnd-gold" />} title="Campaigns" count={campaigns?.length} />
          {home.isPending ? (
            <CardSkeletons />
          ) : home.error ? (
            <EmptyCard icon={<Scroll className="h-10 w-10" />} text={`Couldn’t load your campaigns: ${home.error.message}`} />
          ) : campaigns!.length === 0 ? (
            <EmptyCard icon={<Scroll className="h-10 w-10" />} text="No campaigns yet. When your DM sends an invite link, open it and pick your character." />
          ) : (
            <CardGrid>
              {campaigns!.map((c) => (
                <SceneCard
                  key={c.id}
                  to={`/campaigns/${c.id}`}
                  glow="gold"
                  title={c.name}
                  description={c.description}
                  background={c.background_url}
                  strip={c.character ? `PLAYING ${c.character.name.toUpperCase()}` : 'CHOOSE A CHARACTER'}
                  live={c.character === null}
                  tags={[`DM ${c.dm_name}`]}
                  creatures={c.party}
                />
              ))}
            </CardGrid>
          )}
        </section>

        <section aria-label="Encounters">
          <SectionHeading icon={<Swords className="h-5 w-5 text-dnd-crimson" />} title="Encounters" count={encounters?.length} />
          {home.isPending ? (
            <CardSkeletons />
          ) : encounters && encounters.length === 0 ? (
            <EmptyCard
              icon={<Swords className="h-10 w-10" />}
              text="No fights yet. Encounters your DM runs for your campaigns appear here on their own, and so do the ones you’re invited to directly."
            />
          ) : (
            <EncounterGroups
              groups={groupEncounters(encounters ?? [], (campaigns ?? []).map((c) => ({ id: c.id, name: c.name })))}
              looseLabel="Invited directly"
              render={(e, folder) => (
                <SceneCard
                  key={e.id}
                  to={`/encounters/${e.id}/view`}
                  title={e.title}
                  description={e.description}
                  background={e.background_url}
                  strip={e.started ? `ROUND ${e.round} · IN PROGRESS` : 'NOT STARTED'}
                  live={e.started}
                  tags={[e.live && 'Live', !folder && e.campaign_name, e.character_name && `as ${e.character_name}`].filter((t): t is string => Boolean(t))}
                  creatures={[]}
                />
              )}
            />
          )}
        </section>
      </div>
    </Layout>
  )
}
