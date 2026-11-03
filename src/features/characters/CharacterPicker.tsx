import { Heart, Shield, UserPlus } from 'lucide-react'
import { Token } from '@/components/ui/tokens'
import { classSummary } from '@/lib/sheet'
import type { PartyMember } from '@/lib/types'

interface CharacterPickerProps {
  /** Characters the DM made that nobody plays yet. */
  characters: PartyMember[]
  onClaim: (id: string) => void
  onCreate: () => void
  pending?: boolean
  claimLabel?: string
}

/** Pick one of the DM's characters, or make your own. */
export function CharacterPicker({ characters, onClaim, onCreate, pending, claimLabel = 'Play' }: CharacterPickerProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {characters.map((c) => (
        <li key={c.id} className="dnd-card group flex items-center gap-3 p-4 transition-all hover:border-dnd-gold/60 hover:shadow-glow-gold">
          <Token name={c.name} src={c.image_url} isPlayer size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-body text-dnd-parchment group-hover:text-dnd-gold">{c.name}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-dnd-muted">
              {c.classes.length > 0 && <span>{classSummary(c.classes)}</span>}
              {c.max_hp !== null && (
                <span className="flex items-center gap-0.5">
                  <Heart className="h-3 w-3 text-red-400" /> {c.max_hp}
                </span>
              )}
              {c.armor_class !== null && (
                <span className="flex items-center gap-0.5">
                  <Shield className="h-3 w-3 text-sky-400" /> {c.armor_class}
                </span>
              )}
            </p>
          </div>
          <button type="button" className="dnd-button-secondary px-3 py-1.5 text-sm" disabled={pending} onClick={() => onClaim(c.id)} aria-label={`${claimLabel} ${c.name}`}>
            {claimLabel}
          </button>
        </li>
      ))}
      <li className="dnd-card flex items-center gap-3 border-dashed p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-dnd-border text-dnd-muted">
          <UserPlus className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-dnd-parchment">Your own</p>
          <p className="font-ui text-xs text-dnd-muted italic">Fill in a sheet, or import it from D&D Beyond.</p>
        </div>
        <button type="button" className="dnd-button-primary px-3 py-1.5 text-sm" disabled={pending} onClick={onCreate}>
          Make one
        </button>
      </li>
    </ul>
  )
}
