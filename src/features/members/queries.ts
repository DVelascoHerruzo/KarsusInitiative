import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { optimistic } from '@/lib/optimistic'
import type { Invites, Member, Role } from '@/lib/types'

/**
 * The DM's side of inviting: make, reset or switch off a role's link, change a
 * member's role, remove them. `base` is `encounters/<id>` or `presets/<id>`, and
 * `queryKey` is the page's own query, refetched after each change.
 */
export function useMemberMutations(base: string, queryKey: QueryKey) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey })
  const onError = (error: Error) => toast.error(error.message)
  return {
    resetInvite: useMutation({ mutationFn: (role: Role) => api.post<Invites>(`${base}/invites/${role}`), onSuccess: refresh, onError }),
    closeInvite: useMutation({ mutationFn: (role: Role) => api.delete(`${base}/invites/${role}`), onSuccess: refresh, onError }),
    setRole: useMutation({
      mutationFn: ({ userId, role }: { userId: string; role: Role }) => api.patch<Member[]>(`${base}/members/${userId}`, { role }),
      onSuccess: refresh,
      onError,
    }),
    // Gone from the list at once; the request follows.
    remove: useMutation({
      mutationFn: (userId: string) => api.delete(`${base}/members/${userId}`),
      ...optimistic<string, { members: Member[] }>(qc, queryKey, (d, userId) => ({ ...d, members: d.members.filter((m) => m.user_id !== userId) })),
    }),
  }
}

export const inviteUrl = (token: string) => `${window.location.origin}/join/${token}`
