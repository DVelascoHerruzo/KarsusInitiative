import { Dialog } from '@/components/ui/Dialog'
import { Kbd } from '@/components/ui/display'

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['Space', '→'], label: 'Next turn (or start combat)' },
  { keys: ['Shift Space', '←'], label: 'Previous turn' },
  { keys: ['↓', 'J'], label: 'Select next creature' },
  { keys: ['↑', 'K'], label: 'Select previous creature' },
  { keys: ['D'], label: 'Damage selected' },
  { keys: ['H'], label: 'Heal selected' },
  { keys: ['T'], label: 'Temp HP for selected' },
  { keys: ['C'], label: 'Conditions for selected' },
  { keys: ['E'], label: 'Edit selected' },
  { keys: ['A'], label: 'Add creature' },
  { keys: ['I'], label: 'Roll monster initiative' },
  { keys: ['R'], label: 'Focus the dice roller' },
  { keys: ['?'], label: 'Show this list' },
]

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" size="sm">
      <dl className="space-y-2.5">
        {SHORTCUTS.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-ink-muted">{s.label}</dt>
            <dd className="flex shrink-0 gap-1">
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
