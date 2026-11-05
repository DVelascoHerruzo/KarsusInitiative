import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { usePresetList } from '@/features/presets/queries'
import { api } from '@/lib/api'
import { keys } from './queries'

interface CampaignSelectProps {
  encounterId: string
  /** A campaign's encounters are stored with its DM, so only that DM's campaigns are offered. */
  ownerId: string
  value: string | null
  className?: string
}

/**
 * Which campaign an encounter belongs to. Launching a campaign sets it; its
 * players see every encounter in it unless it's hidden.
 */
export function CampaignSelect({ encounterId, ownerId, value, className }: CampaignSelectProps) {
  const qc = useQueryClient()
  const presets = usePresetList()
  const campaigns = (presets.data ?? []).filter((p) => p.owner_id === ownerId)
  const move = useMutation({
    mutationFn: (campaign_id: string | null) => api.patch(`encounters/${encounterId}`, { campaign_id }),
    onSuccess: (_, campaign_id) => {
      void qc.invalidateQueries({ queryKey: keys.encounters })
      void qc.invalidateQueries({ queryKey: keys.encounter(encounterId) })
      const name = campaigns.find((f) => f.id === campaign_id)?.name
      toast.success(name ? `Added to ${name}` : 'Taken out of its campaign', {
        description: name ? 'That campaign’s players can see it now, unless it’s hidden.' : 'Only players you invite to it directly can see it.',
      })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <label className={className}>
      <span className="dnd-label flex items-center gap-1.5">
        <BookOpen className="h-3.5 w-3.5" /> Campaign
      </span>
      <select
        className="dnd-input"
        value={value ?? ''}
        disabled={move.isPending || presets.isPending}
        onChange={(e) => move.mutate(e.target.value || null)}
      >
        <option value="">No campaign</option>
        {campaigns.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
            {f.members > 0 ? ` (${f.members} ${f.members === 1 ? 'player' : 'players'})` : ''}
          </option>
        ))}
      </select>
      <span className="mt-1 block font-ui text-xs text-dnd-muted italic">
        Its players see this encounter, unless you hide it.
      </span>
    </label>
  )
}
