import { HeartCrack, HeartPlus, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Panel, PanelAction, PanelHeader } from '@/components/ui/Panel'
import { Avatar, ConditionChip, HpBar } from '@/components/ui/display'
import { formatModifier } from '@/lib/dice'
import type { Creature } from '@/lib/types'

interface SpotlightCardProps {
  creature: Creature | null
  isActive: boolean
  onDamage: () => void
  onHeal: () => void
  onConditions: () => void
  onEdit: () => void
  onRemove: () => void
}

/** Detail for the selected creature: the active one, unless the DM has picked another. */
export function SpotlightCard({ creature: c, isActive, onDamage, onHeal, onConditions, onEdit, onRemove }: SpotlightCardProps) {
  return (
    <Panel aria-label="Selected creature" className="border-b border-line">
      <PanelHeader
        title={c && isActive ? 'Acting now' : 'Selected'}
        meta={c ? (c.is_player ? 'player character' : 'creature') : undefined}
        actions={
          c && (
            <>
              <PanelAction onClick={onEdit} aria-label={`Edit ${c.name}`} aria-keyshortcuts="E">
                <Pencil /> Edit
              </PanelAction>
              <PanelAction onClick={onRemove} aria-label={`Remove ${c.name}`} className="hover:text-vellum hover:[--wedge:var(--color-rubric)]">
                <Trash2 />
              </PanelAction>
            </>
          )
        }
      />
      {c ? (
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={c.name} src={c.image_url} size={56} />
            <h3 className="display min-w-0 text-2xl text-vellum">{c.name}</h3>
          </div>

          <dl className="grid grid-cols-3 gap-px bg-line">
            <Stat label="initiative" value={`${c.initiative}`} sub={formatModifier(c.initiative_bonus)} />
            <Stat label="armor class" value={c.armor_class?.toString() ?? '—'} />
            <Stat
              label="hit points"
              value={c.current_hp !== null ? `${c.current_hp}` : '—'}
              sub={c.max_hp !== null ? `/${c.max_hp}${c.temp_hp ? ` +${c.temp_hp}` : ''}` : undefined}
            />
          </dl>

          <HpBar current={c.current_hp} max={c.max_hp} temp={c.temp_hp} thick />

          {c.conditions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.conditions.map((x) => (
                <ConditionChip key={x.key} condition={x} size="md" />
              ))}
            </div>
          )}

          {c.notes && (
            <div className="border-l-2 border-accent bg-canvas px-3 py-2.5">
              <p className="hint mb-1">your notes</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">{c.notes}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" onClick={onDamage} disabled={c.current_hp === null} className="hover:text-signal">
              <HeartCrack /> Damage
            </Button>
            <Button size="sm" onClick={onHeal} disabled={c.current_hp === null} className="hover:text-accent">
              <HeartPlus /> Heal
            </Button>
            <Button size="sm" onClick={onConditions}>
              <Sparkles /> Effects
            </Button>
          </div>
        </div>
      ) : (
        <p className="p-4 text-sm text-ink-faint">Add creatures to begin.</p>
      )}
    </Panel>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-panel px-3 pt-2 pb-2.5">
      <dt className="hint">{label}</dt>
      <dd className="tabular display mt-1.5 text-2xl text-vellum">
        {value}
        {sub && <span className="cmd ml-1 text-xs tracking-normal text-ink-faint normal-case">{sub}</span>}
      </dd>
    </div>
  )
}
