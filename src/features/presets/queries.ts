import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { CreaturePatch, NewCreature, Preset, PresetFields, PresetSummary } from '@/lib/types'
import { keys as encounterKeys, orNotFound, withConditions } from '@/features/encounters/queries'

export const presetKeys = {
  presets: ['presets'] as const,
  preset: (id: string) => ['preset', id] as const,
}

export function usePresetList() {
  return useQuery({ queryKey: presetKeys.presets, queryFn: () => api.get<PresetSummary[]>('presets') })
}

export function usePreset(id: string) {
  return useQuery({
    queryKey: presetKeys.preset(id),
    queryFn: async (): Promise<Preset> => {
      const preset = await orNotFound(api.get<Preset>(`presets/${id}`))
      return { ...preset, creatures: preset.creatures.map(withConditions) }
    },
  })
}

export function useCreatePreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PresetFields) => api.post<{ id: string }>('presets', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: presetKeys.presets }),
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeletePreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`presets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: presetKeys.presets }),
    onError: (error: Error) => toast.error(error.message),
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

/** Preset edits are low-frequency, so these simply refetch rather than patching optimistically. */
export function usePresetMutations(id: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: presetKeys.preset(id) })
  const onError = (error: Error) => toast.error(error.message)
  const base = `presets/${id}`

  return {
    update: useMutation({
      mutationFn: (patch: Partial<PresetFields>) => api.patch(base, patch),
      onSuccess: refresh,
      onError,
    }),
    addCreatures: useMutation({
      mutationFn: (creatures: NewCreature[]) => api.post(`${base}/creatures`, { creatures }),
      onSuccess: refresh,
      onError,
    }),
    updateCreature: useMutation({
      mutationFn: ({ cid, patch }: { cid: string; patch: CreaturePatch }) => api.patch(`${base}/creatures/${cid}`, patch),
      onSuccess: refresh,
      onError,
    }),
    removeCreature: useMutation({
      mutationFn: (cid: string) => api.delete(`${base}/creatures/${cid}`),
      onSuccess: refresh,
      onError,
    }),
  }
}
