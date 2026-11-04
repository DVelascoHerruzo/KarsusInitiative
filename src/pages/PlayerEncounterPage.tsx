import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { DoorClosed } from 'lucide-react'
import { toast } from 'sonner'
import { MessageScreen } from '@/components/ui/Scene'
import { FullScreenLoader } from '@/components/ui/tokens'
import { ConditionsDialog } from '@/features/combat/ConditionsDialog'
import { HpDialog, type HpMode } from '@/features/combat/HpDialog'
import { NotFoundError, useLivePings } from '@/features/encounters/queries'
import { DisplayView } from '@/features/play/DisplayView'
import { playerKeys, usePlayerEncounter, useUpdateCharacter, useUpdateOwnCreature } from '@/features/player/queries'
import type { CharacterSheet, Creature, CreaturePatch, PlayerEncounter } from '@/lib/types'

/** The visual view for a signed-in player: the same screen as the table, with their own character in their hands. */
export default function PlayerEncounterPage() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const { data, isPending, error } = usePlayerEncounter(id)
  const update = useUpdateOwnCreature(id)
  const updateCampaignCharacter = useUpdateCharacter(data?.campaign?.id ?? '')
  const [hp, setHp] = useState<{ id: string; mode: HpMode } | null>(null)
  const [conditionsId, setConditionsId] = useState<string | null>(null)

  useLivePings(data ? `encounters/${id}/live` : undefined, () => {
    if (!update.isPending) void qc.invalidateQueries({ queryKey: playerKeys.encounter(id) })
  })

  if (isPending) return <FullScreenLoader label="Entering the battlefield…" />

  if (error || !data) {
    return (
      <MessageScreen
        icon={<DoorClosed className="h-12 w-12 text-dnd-muted" />}
        title="This fight is closed"
        body={error instanceof NotFoundError ? 'Your DM may have hidden it, or it was deleted.' : 'We couldn’t reach the table. Check your connection and refresh.'}
        actions={
          <Link to="/" className="dnd-button-primary">
            Back to your adventures
          </Link>
        }
      />
    )
  }

  const byId = (cid: string | null | undefined) => (cid ? (data.creatures.find((c) => c.id === cid) ?? null) : null)
  const save = (cid: string, patch: CreaturePatch) => {
    if (Object.keys(patch).length) update.mutate({ cid, patch })
  }

  /** A campaign character's slots live on the campaign, so spending one shows in every fight; otherwise on this fight's copy. */
  function spendSlots(ch: Creature, slots: Pick<CharacterSheet, 'spell_slots' | 'pact_slots'>) {
    if (!ch.sheet) return
    const sheet = { ...ch.sheet, ...slots }
    if (data?.campaign && ch.character_id) {
      qc.setQueryData<PlayerEncounter>(playerKeys.encounter(id), (e) => e && { ...e, characters: e.characters.map((x) => (x.id === ch.id ? { ...x, sheet } : x)) })
      updateCampaignCharacter.mutate({ cid: ch.character_id, patch: { sheet } })
    } else {
      save(ch.id, { sheet })
    }
  }

  return (
    <>
      <title>{`${data.title} · Karsus`}</title>
      <DisplayView
        encounter={data}
        mine={data.mine}
        characters={data.characters}
        onSlots={spendSlots}
        onHp={(c) => setHp({ id: c.id, mode: 'damage' })}
        onConditions={(c) => setConditionsId(c.id)}
        back={data.campaign ? { to: `/campaigns/${data.campaign.id}`, label: data.campaign.name } : { to: '/', label: 'Your adventures' }}
        label={data.mine.length ? 'Player View · tap your HP to change it' : 'Player View · Live sync'}
      />
      <HpDialog
        creature={byId(hp?.id)}
        initialMode={hp?.mode ?? 'damage'}
        onClose={() => setHp(null)}
        onApply={(c, result) => {
          save(c.id, result.patch)
          if (result.droppedToZero) toast(`${c.name} falls unconscious`)
          if (result.concentrationDc) toast('Concentration check', { description: `Constitution save, DC ${result.concentrationDc}` })
        }}
      />
      <ConditionsDialog creature={byId(conditionsId)} onClose={() => setConditionsId(null)} onChange={(c, conditions) => save(c.id, { conditions })} />
    </>
  )
}
