import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { CreaturePatch, NewCreature, Preset, PresetFields, PresetPatch, PresetSummary } from '@/lib/types'
import { keys as encounterKeys, orNotFound, withConditions } from '@/features/encounters/queries'
import { optimistic } from '@/lib/optimistic'

export const presetKeys = {
  presets: ['presets'] as const,
  preset: (id: string) => ['preset', id] as const,
}

export function usePresetList() {
  return useQuery({ queryKey: presetKeys.presets, queryFn: () => api.get<PresetSummary[]>('presets') })
}

export const presetQuery = (id: string) =>
  queryOptions({
    queryKey: presetKeys.preset(id),
    queryFn: async (): Promise<Preset> => {
      const preset = await orNotFound(api.get<Preset>(`presets/${id}`))
      return { ...preset, creatures: preset.creatures.map(withConditions) }
    },
  })

export function usePreset(id: string, enabled = true) {
  return useQuery({ ...presetQuery(id), enabled })
}

export function useCreatePreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PresetFields) => api.post<{ id: string }>('presets', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: presetKeys.presets }),
    onError: (error: Error) => toast.error(error.message),
  })
}

/** Gone from the list at once; the delete request follows, and a failure puts it back. */
export function useDeletePreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`presets/${id}`),
    ...optimistic<string, PresetSummary[]>(qc, presetKeys.presets, (list, id) => list.filter((p) => p.id !== id)),
  })
}

/** Rolls fresh monster initiative into a new encounter and returns its id. */
export function useLaunchPreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (presetId: string) => (await api.post<{ id: string }>(`presets/${presetId}/launch`)).id,
    onSuccess: () => qc.invalidateQueries({ queryKey: encounterKeys.encounters }),
    onError: (error: Error) => toast.error(error.message),
  })
}

/** Campaign edits show at once; the request follows and the page refetches when it lands. */
export function usePresetMutations(id: string) {
  const qc = useQueryClient()
  const key = presetKeys.preset(id)
  const refresh = () => qc.invalidateQueries({ queryKey: key })
  const onError = (error: Error) => toast.error(error.message)
  const base = `presets/${id}`

  return {
    update: useMutation({
      mutationFn: (patch: PresetPatch) => api.patch(base, patch),
      ...optimistic<PresetPatch, Preset>(qc, key, (p, patch) => ({ ...p, ...patch })),
    }),
    addCreatures: useMutation({
      mutationFn: (creatures: NewCreature[]) => api.post(`${base}/creatures`, { creatures }),
      onSuccess: refresh,
      onError,
    }),
    updateCreature: useMutation({
      mutationFn: ({ cid, patch }: { cid: string; patch: CreaturePatch }) => api.patch(`${base}/creatures/${cid}`, patch),
      ...optimistic<{ cid: string; patch: CreaturePatch }, Preset>(qc, key, (p, { cid, patch }) => ({
        ...p,
        creatures: p.creatures.map((c) => (c.id === cid ? { ...c, ...patch } : c)),
      })),
    }),
    removeCreature: useMutation({
      mutationFn: (cid: string) => api.delete(`${base}/creatures/${cid}`),
      ...optimistic<string, Preset>(qc, key, (p, cid) => ({ ...p, creatures: p.creatures.filter((c) => c.id !== cid) })),
    }),
  }
}
