import { useState } from 'react'
import type { QueryKey } from '@tanstack/react-query'
import { Copy, Crown, Link2, RotateCcw, UserMinus, Users, X } from 'lucide-react'
import ConfirmDelete from '@/components/ui/ConfirmDelete'
import { Token } from '@/components/ui/tokens'
import { useAuth } from '@/features/auth/AuthProvider'
import { copyText } from '@/features/encounters/ShareDialog'
import { cn } from '@/lib/cn'
import type { Creature, Invites, Member, Role } from '@/lib/types'
import { inviteUrl, useMemberMutations } from './queries'

interface MembersPanelProps {
  kind: 'campaign' | 'encounter'
  /** `presets/<id>` or `encounters/<id>`. */
  base: string
  queryKey: QueryKey
  members: Member[]
  invites: Invites
  creatures: Creature[]
}

/** Invite links for each role, and everyone they've let in. */
export function MembersPanel({ kind, base, queryKey, members, invites, creatures }: MembersPanelProps) {
  const { user } = useAuth()
  const m = useMemberMutations(base, queryKey)
  const [removing, setRemoving] = useState<Member | null>(null)
  const playing = (userId: string) => creatures.filter((c) => c.player_id === userId && c.is_player)
  const pending = m.resetInvite.isPending || m.closeInvite.isPending
  const self = removing?.user_id === user?.id

  return (
    <div className="space-y-5">
      <InviteRow
        role="player"
        token={invites.player}
        hint={
          kind === 'campaign'
            ? 'Players pick a character or make their own, and see every encounter you launch from this campaign unless you hide it.'
            : 'Players pick a character or make their own, and follow the fight on the visual view.'
        }
        onReset={() => m.resetInvite.mutate('player')}
        onClose={() => m.closeInvite.mutate('player')}
        pending={pending}
      />
      <InviteRow
        role="dm"
        token={invites.dm}
        hint={`Co-DMs run the ${kind} with you and can change everything except deleting it.`}
        onReset={() => m.resetInvite.mutate('dm')}
        onClose={() => m.closeInvite.mutate('dm')}
        pending={pending}
      />

      <div>
        <p className="dnd-label">{members.length === 0 ? 'No one has joined yet' : `${members.length} joined`}</p>
        {members.length > 0 && (
          <ul className="space-y-1.5">
            {members.map((member) => {
              const characters = playing(member.user_id)
              return (
                <li key={member.user_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-dnd-border/40 bg-dnd-dark/60 px-3 py-2">
                  <Token name={member.username} src={null} isPlayer size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm text-dnd-parchment">
                      {member.username}
                      {member.user_id === user?.id && <span className="text-dnd-muted"> (you)</span>}
                    </p>
                    <p className="truncate font-ui text-xs text-dnd-muted italic">
                      {member.role === 'dm'
                        ? 'Runs it with you'
                        : characters.length
                          ? `Plays ${characters.map((c) => c.name).join(', ')}`
                          : 'Hasn’t picked a character'}
                    </p>
                  </div>
                  <select
                    aria-label={`Role for ${member.username}`}
                    value={member.role}
                    onChange={(e) => m.setRole.mutate({ userId: member.user_id, role: e.target.value as Role })}
                    className="dnd-input w-auto py-1 pr-8 pl-2 text-xs"
                  >
                    <option value="player">Player</option>
                    <option value="dm">Co-DM</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setRemoving(member)}
                    aria-label={`Remove ${member.username}`}
                    title={`Remove ${member.username}`}
                    className="rounded p-1.5 text-dnd-muted transition-colors hover:text-dnd-red"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ConfirmDelete
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={self ? `Leave ${kind}` : 'Remove member'}
        confirmLabel={self ? 'Leave' : 'Remove'}
        loading={m.remove.isPending}
        body={
          self
            ? `You’ll lose access to the ${kind} until someone invites you again.`
            : `${removing?.username} loses access to the ${kind}. Any character they played stays, free for someone else to pick.`
        }
        onConfirm={async () => {
          if (removing) await m.remove.mutateAsync(removing.user_id).catch(() => {})
          setRemoving(null)
        }}
      />
    </div>
  )
}

interface InviteRowProps {
  role: Role
  token: string | null
  hint: string
  onReset: () => void
  onClose: () => void
  pending: boolean
}

function InviteRow({ role, token, hint, onReset, onClose, pending }: InviteRowProps) {
  const url = token ? inviteUrl(token) : null
  const Icon = role === 'dm' ? Crown : Users
  return (
    <div className={cn('rounded-lg border bg-dnd-dark/60 p-4', role === 'dm' ? 'border-dnd-gold/40' : 'border-dnd-jade/40')}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={cn('flex items-center gap-2 font-body text-sm tracking-widest uppercase', role === 'dm' ? 'text-dnd-gold' : 'text-dnd-jade')}>
          <Icon className="h-4 w-4" /> {role === 'dm' ? 'Co-DM link' : 'Player link'}
        </h3>
        {url && (
          <span className="flex gap-0.5">
            <button
              type="button"
              disabled={pending}
              onClick={onReset}
              title="Make a new link (the old one stops working)"
              aria-label="Make a new link (the old one stops working)"
              className="rounded p-1.5 text-dnd-muted hover:text-dnd-parchment"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              title="Switch the link off"
              aria-label="Switch the link off"
              className="rounded p-1.5 text-dnd-muted hover:text-dnd-red"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>
      <p className="mt-1 font-ui text-xs text-dnd-muted italic">{hint}</p>
      {url ? (
        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={url}
            aria-label={role === 'dm' ? 'Co-DM invite link' : 'Player invite link'}
            onFocus={(e) => e.target.select()}
            className="dnd-input min-w-0 flex-1 py-2 text-xs text-dnd-muted"
          />
          <button type="button" className="dnd-button-secondary px-3 py-2" onClick={() => copyText(url, 'Invite link')}>
            <Copy className="h-4 w-4" /> Copy
          </button>
        </div>
      ) : (
        <button type="button" className="dnd-button-secondary mt-3 px-4 py-1.5 text-sm" disabled={pending} onClick={onReset}>
          <Link2 className="h-4 w-4" /> Make a link
        </button>
      )}
    </div>
  )
}
