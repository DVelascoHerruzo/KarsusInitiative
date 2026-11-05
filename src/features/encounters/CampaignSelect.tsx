import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Folder } from 'lucide-react'
import { toast } from 'sonner'
import { usePresetList } from '@/features/presets/queries'
import { api } from '@/lib/api'
import { keys } from './queries'

interface FolderSelectProps {
  encounterId: string
  /** Folders hold one DM's encounters, so only that DM's presets are offered. */
  ownerId: string
  value: string | null
  className?: string
}

/**
 * Which folder an encounter is in. A folder is a preset: launching one files the
 * encounter there, and its players see every encounter inside unless it's hidden.
 */
export function FolderSelect({ encounterId, ownerId, value, className }: FolderSelectProps) {
  const qc = useQueryClient()
  const presets = usePresetList()
  const folders = (presets.data ?? []).filter((p) => p.owner_id === ownerId)
  const move = useMutation({
    mutationFn: (campaign_id: string | null) => api.patch(`encounters/${encounterId}`, { campaign_id }),
    onSuccess: (_, campaign_id) => {
      void qc.invalidateQueries({ queryKey: keys.encounters })
      void qc.invalidateQueries({ queryKey: keys.encounter(encounterId) })
      const name = folders.find((f) => f.id === campaign_id)?.name
      toast.success(name ? `Moved to ${name}` : 'Moved out of its folder', {
        description: name ? 'Players in that campaign can see it now, unless it’s hidden.' : undefined,
      })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <label className={className}>
      <span className="dnd-label flex items-center gap-1.5">
        <Folder className="h-3.5 w-3.5" /> Folder
      </span>
      <select
        className="dnd-input"
        value={value ?? ''}
        disabled={move.isPending || presets.isPending}
        onChange={(e) => move.mutate(e.target.value || null)}
      >
        <option value="">No folder</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
            {f.members > 0 ? ` (${f.members} ${f.members === 1 ? 'player' : 'players'})` : ''}
          </option>
        ))}
      </select>
      <span className="mt-1 block font-ui text-xs text-dnd-muted italic">
        Folders are your presets. Players in a preset’s campaign see every encounter in its folder.
      </span>
    </label>
  )
}
