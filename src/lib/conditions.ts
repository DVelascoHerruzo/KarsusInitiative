import type { Condition } from './types'

export type ConditionTone = 'danger' | 'control' | 'sense' | 'buff' | 'neutral'

export interface ConditionDef {
  key: string
  label: string
  tone: ConditionTone
  summary: string
}

/** The SRD conditions plus the states DMs track most often. Summaries are short reminders, not rules text. */
export const CONDITIONS: readonly ConditionDef[] = [
  { key: 'concentrating', label: 'Concentrating', tone: 'buff', summary: 'Taking damage forces a Con save (DC 10 or half the damage).' },
  { key: 'blinded', label: 'Blinded', tone: 'sense', summary: 'Can’t see. Attacks against it have advantage; its attacks have disadvantage.' },
  { key: 'charmed', label: 'Charmed', tone: 'control', summary: 'Can’t attack the charmer, who has advantage on social checks against it.' },
  { key: 'deafened', label: 'Deafened', tone: 'sense', summary: 'Can’t hear; fails checks that rely on hearing.' },
  { key: 'exhaustion', label: 'Exhaustion', tone: 'danger', summary: 'Cumulative penalty to d20 tests; level 6 is death.' },
  { key: 'frightened', label: 'Frightened', tone: 'control', summary: 'Disadvantage while the source is in sight; can’t move closer to it.' },
  { key: 'grappled', label: 'Grappled', tone: 'control', summary: 'Speed 0. Disadvantage on attacks against anyone but the grappler.' },
  { key: 'incapacitated', label: 'Incapacitated', tone: 'control', summary: 'No actions, bonus actions or reactions. Concentration breaks.' },
  { key: 'invisible', label: 'Invisible', tone: 'sense', summary: 'Can’t be seen. Its attacks have advantage; attacks against it have disadvantage.' },
  { key: 'paralyzed', label: 'Paralyzed', tone: 'danger', summary: 'Incapacitated, can’t move. Hits from within 5 ft are crits.' },
  { key: 'petrified', label: 'Petrified', tone: 'danger', summary: 'Turned to stone. Incapacitated, resistant to all damage.' },
  { key: 'poisoned', label: 'Poisoned', tone: 'danger', summary: 'Disadvantage on attack rolls and ability checks.' },
  { key: 'prone', label: 'Prone', tone: 'control', summary: 'Melee attacks against it have advantage; ranged have disadvantage.' },
  { key: 'restrained', label: 'Restrained', tone: 'control', summary: 'Speed 0. Disadvantage on attacks and Dex saves.' },
  { key: 'stunned', label: 'Stunned', tone: 'danger', summary: 'Incapacitated. Fails Str and Dex saves; attacks against it have advantage.' },
  { key: 'unconscious', label: 'Unconscious', tone: 'danger', summary: 'Incapacitated and prone. Drops what it holds; hits within 5 ft are crits.' },
  { key: 'dead', label: 'Dead', tone: 'neutral', summary: 'Out of the fight. Skipped in the turn order.' },
]

const BY_KEY = new Map(CONDITIONS.map((c) => [c.key, c]))

export function conditionDef(condition: Pick<Condition, 'key' | 'label'>): ConditionDef {
  return (
    BY_KEY.get(condition.key) ?? {
      key: condition.key,
      label: condition.label ?? condition.key.replace(/^custom:/, ''),
      tone: 'buff',
      summary: 'Custom effect',
    }
  )
}

export function customConditionKey(label: string): string {
  return `custom:${label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

export function hasCondition(conditions: readonly Condition[], key: string): boolean {
  return conditions.some((c) => c.key === key)
}

export function withCondition(conditions: readonly Condition[], next: Condition): Condition[] {
  return [...conditions.filter((c) => c.key !== next.key), next]
}

export function withoutCondition(conditions: readonly Condition[], ...keys: string[]): Condition[] {
  return conditions.filter((c) => !keys.includes(c.key))
}

/** Defensive parse for JSON coming off the wire. */
export function parseConditions(value: unknown): Condition[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((v): Condition[] => {
    if (typeof v !== 'object' || v === null || typeof (v as Condition).key !== 'string') return []
    const { key, label, rounds } = v as Condition
    return [{ key, ...(label ? { label } : {}), rounds: typeof rounds === 'number' ? rounds : null }]
  })
}
