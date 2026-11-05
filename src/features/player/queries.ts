import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type {
  CampaignView,
  CharacterChoice,
  Creature,
  CreaturePatch,
  InvitePreview,
  NewCreature,
  PlayerEncounter,
  PlayerHome,
  Role,
} from '@/lib/types'
import { orNotFound, pollEvery, withConditions } from '@/features/encounters/queries'

export const playerKeys = {
  home: ['player'] as const,
  campaign: (id: string) => ['campaign', id] as const,
  encounter: (id: string) => ['player-encounter', id] as const,
  invite: (token: string) => ['invite', token] as const,
}

const onError = (error: Error) => toast.error(error.message)

export function usePlayerHome() {
  // Often enough that a fight going live shows up without a reload.
  return useQuery({ queryKey: playerKeys.home, queryFn: () => api.get<PlayerHome>('player'), refetchInterval: 10_000 })
}

export const campaignQuery = (id: string) =>
  queryOptions({
    queryKey: playerKeys.campaign(id),
    queryFn: async () => {
      const view = await orNotFound(api.get<CampaignView>(`presets/${id}/campaign`))
      return { ...view, mine: view.mine && withConditions(view.mine) }
    },
  })

export function useCampaign(id: string) {
  return useQuery({ ...campaignQuery(id), refetchInterval: 10_000 })
}

export function useInvite(token: string) {
  return useQuery({ queryKey: playerKeys.invite(token), queryFn: () => orNotFound(api.get<InvitePreview>(`invites/${token}`)), retry: false })
}

export function useAcceptInvite(token: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (choice: CharacterChoice | Record<string, never>) =>
      api.post<{ kind: 'campaign' | 'encounter'; id: string; role: Role | 'owner' }>(`invites/${token}`, choice),
    onSuccess: () => qc.invalidateQueries(),
    onError,
  })
}

export function useCharacterChoice(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (choice: CharacterChoice) => api.post<CampaignView>(`presets/${campaignId}/character`, choice),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: playerKeys.campaign(campaignId) })
      void qc.invalidateQueries({ queryKey: playerKeys.home })
    },
    onError,
  })
}

/** A player edits their own campaign character; the server copies it into the campaign's fights. */
export function useUpdateCharacter(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ cid, patch }: { cid: string; patch: CreaturePatch }) => api.patch<Creature>(`presets/${campaignId}/creatures/${cid}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: playerKeys.campaign(campaignId) }),
    onError,
  })
}

/** Leaving a campaign or an encounter. The DM removing someone uses the same call with their id. */
export function useLeave(kind: 'presets' | 'encounters', id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.delete(`${kind}/${id}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries(),
    onError,
  })
}

export const playerEncounterQuery = (id: string) =>
  queryOptions({
    queryKey: playerKeys.encounter(id),
    queryFn: async () => {
      const view = await orNotFound(api.get<PlayerEncounter>(`encounters/${id}/view`))
      return { ...view, creatures: view.creatures.map(withConditions), characters: view.characters.map(withConditions) }
    },
  })

/**
 * Live pings bring changes the moment they happen; while they're connected this
 * only checks now and then. Without them it polls every couple of seconds
 * (paused while the tab is hidden), and unchanged polls come back as an empty 304.
 */
export function usePlayerEncounter(id: string, liveConnected = false) {
  return useQuery({ ...playerEncounterQuery(id), refetchInterval: pollEvery(liveConnected) })
}

/** A player changes their own HP or conditions mid-fight. Optimistic, like the DM screen. */
export function useUpdateOwnCreature(encounterId: string) {
  const qc = useQueryClient()
  const key = playerKeys.encounter(encounterId)
  return useMutation({
    mutationFn: ({ cid, patch }: { cid: string; patch: CreaturePatch }) => api.patch(`encounters/${encounterId}/creatures/${cid}`, patch),
    onMutate: async ({ cid, patch }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<PlayerEncounter>(key)
      const apply = <T extends { id: string }>(list: T[]) => list.map((c) => (c.id === cid ? { ...c, ...patch } : c))
      qc.setQueryData<PlayerEncounter>(key, (e) => e && { ...e, creatures: apply(e.creatures), characters: apply(e.characters) })
      return { previous }
    },
    onError: (error: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
      onError(error)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

/** Reads a public D&D Beyond character into a draft for the character form. Nothing is saved yet. */
export const importFromDndBeyond = (url: string) => api.post<NewCreature>('import/dndbeyond', { url })
