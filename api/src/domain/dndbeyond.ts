import { ABILITY_KEYS, SKILL_KEYS, abilityModifier, castingAbilityFor, slotsFor, totalLevel } from '@/lib/sheet'
import type { Ability, CharacterSheet, ClassLevel, Item, NewCreature, Proficiency, Skill } from '@/lib/types'

// Reads a public D&D Beyond character into a Karsus character. D&D Beyond has no
// published API: this is the JSON its own character sheet loads, so every field
// is read defensively and the numbers it derives (HP, AC, speed) are a best
// effort the player confirms before saving.

/** The character id from any D&D Beyond character link, or null. */
export function characterIdFromUrl(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (!/(^|\.)dndbeyond\.com$|^ddb\.ac$/.test(url.hostname)) return null
  return /\/characters\/(\d{1,12})(\/|$)/.exec(url.pathname)?.[1] ?? null
}

export const characterJsonUrl = (id: string) => `https://character-service.dndbeyond.com/character/v5/character/${id}`

// The slice of the JSON this reads. Everything is optional: unknown shapes degrade to defaults.
interface DdbModifier {
  type?: string
  subType?: string
  value?: number | null
  statId?: number | null
}
interface DdbStat {
  id?: number
  value?: number | null
}
interface DdbSlot {
  level?: number
  used?: number
}
export interface DdbCharacter {
  id?: number
  name?: string
  decorations?: { avatarUrl?: string | null }
  race?: { fullName?: string | null; weightSpeeds?: { normal?: { walk?: number } } }
  background?: { definition?: { name?: string } | null; customBackground?: { name?: string | null } | null }
  classes?: {
    level?: number
    definition?: { name?: string; spellCastingAbilityId?: number | null }
    subclassDefinition?: { name?: string; spellCastingAbilityId?: number | null } | null
  }[]
  stats?: DdbStat[]
  bonusStats?: DdbStat[]
  overrideStats?: DdbStat[]
  baseHitPoints?: number
  bonusHitPoints?: number | null
  overrideHitPoints?: number | null
  modifiers?: Record<string, DdbModifier[] | undefined>
  inventory?: {
    quantity?: number
    equipped?: boolean
    definition?: { name?: string; armorClass?: number | null; armorTypeId?: number | null }
  }[]
  spellSlots?: DdbSlot[]
  pactMagic?: DdbSlot[]
}

const ABILITY_NAMES: Record<Ability, string> = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma',
}
/** D&D Beyond numbers abilities 1–6 in the usual order. */
const abilityById = (id: number | null | undefined): Ability | null => (id && id >= 1 && id <= 6 ? ABILITY_KEYS[id - 1]! : null)

const ARMOR = { light: 1, medium: 2, heavy: 3, shield: 4 }
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const clampInt = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)))

export function fromDndBeyond(data: DdbCharacter): NewCreature {
  const modifiers = Object.values(data.modifiers ?? {}).flatMap((list) => (Array.isArray(list) ? list : []))
  const mods = (type: string, subType: string) => modifiers.filter((m) => m.type === type && m.subType === subType)
  const sum = (type: string, subType: string) => mods(type, subType).reduce((total, m) => total + num(m.value), 0)

  const classes: ClassLevel[] = (data.classes ?? [])
    .filter((c) => c.definition?.name)
    .map((c) => ({ name: c.definition!.name!.slice(0, 40), subclass: c.subclassDefinition?.name?.slice(0, 60) ?? null, level: clampInt(num(c.level), 1, 20) }))
  const level = Math.max(1, totalLevel(classes))

  const abilities = {} as Record<Ability, number>
  ABILITY_KEYS.forEach((key, i) => {
    const id = i + 1
    const override = data.overrideStats?.find((s) => s.id === id)?.value
    const base = num(data.stats?.find((s) => s.id === id)?.value) || 10
    let score = base + num(data.bonusStats?.find((s) => s.id === id)?.value) + sum('bonus', `${ABILITY_NAMES[key]}-score`)
    // "Set" items (a Headband of Intellect) raise the score to a floor.
    for (const m of mods('set', `${ABILITY_NAMES[key]}-score`)) score = Math.max(score, num(m.value))
    abilities[key] = clampInt(override ?? score, 1, 30)
  })
  const mod = (a: Ability) => abilityModifier(abilities[a])

  const saves = ABILITY_KEYS.filter((a) => mods('proficiency', `${ABILITY_NAMES[a]}-saving-throws`).length > 0)
  const skills: Partial<Record<Skill, Proficiency>> = {}
  for (const skill of SKILL_KEYS) {
    if (mods('expertise', skill).length) skills[skill] = 'expertise'
    else if (mods('proficiency', skill).length) skills[skill] = 'proficient'
  }

  const maxHp =
    data.overrideHitPoints ??
    num(data.baseHitPoints) + num(data.bonusHitPoints) + (mod('con') + sum('bonus', 'hit-points-per-level')) * level

  // Armor class: worn armor (or 10 + Dex and any unarmored defense), then a shield and flat bonuses.
  const worn = (data.inventory ?? []).filter((i) => i.equipped && i.definition?.armorTypeId)
  const armor = worn
    .filter((i) => i.definition!.armorTypeId !== ARMOR.shield)
    .sort((a, b) => num(b.definition!.armorClass) - num(a.definition!.armorClass))[0]?.definition
  const shield = worn.find((i) => i.definition!.armorTypeId === ARMOR.shield)?.definition
  let ac: number
  if (armor) {
    const dex = armor.armorTypeId === ARMOR.heavy ? 0 : armor.armorTypeId === ARMOR.medium ? Math.min(2, mod('dex')) : mod('dex')
    ac = num(armor.armorClass) + dex
  } else {
    const unarmored = mods('set', 'unarmored-armor-class').concat(mods('bonus', 'unarmored-armor-class'))
    const best = Math.max(0, ...unarmored.map((m) => (abilityById(m.statId) ? mod(abilityById(m.statId)!) : num(m.value))))
    ac = 10 + mod('dex') + best
  }
  ac += num(shield?.armorClass) + sum('bonus', 'armor-class')

  const walk = Math.max(num(data.race?.weightSpeeds?.normal?.walk), ...mods('set', 'innate-speed-walking').map((m) => num(m.value)))
  const speed = walk + sum('bonus', 'speed') + sum('bonus', 'speed-walking') + (armor ? 0 : sum('bonus', 'unarmored-movement'))

  const first = (data.classes ?? []).map((c) => abilityById(c.definition?.spellCastingAbilityId) ?? abilityById(c.subclassDefinition?.spellCastingAbilityId))
  const slots = slotsFor(classes)
  const usedAt = (list: DdbSlot[] | undefined, lvl: number) => num(list?.find((s) => s.level === lvl)?.used)

  const inventory: Item[] = (data.inventory ?? [])
    .filter((i) => i.definition?.name)
    .slice(0, 100)
    .map((i) => ({ name: i.definition!.name!.slice(0, 80), quantity: clampInt(num(i.quantity) || 1, 0, 9999), equipped: Boolean(i.equipped) }))

  const sheet: CharacterSheet = {
    species: data.race?.fullName?.slice(0, 60) ?? null,
    background: (data.background?.definition?.name ?? data.background?.customBackground?.name)?.slice(0, 60) ?? null,
    classes,
    speed: speed > 0 ? clampInt(speed, 0, 500) : null,
    abilities,
    saves,
    skills,
    spellcasting_ability: first.find((a) => a !== null) ?? castingAbilityFor(classes),
    spell_slots: slots.spell_slots.map((s) => ({ ...s, used: Math.min(s.max, usedAt(data.spellSlots, s.level)) })),
    pact_slots: slots.pact_slots && { ...slots.pact_slots, used: Math.min(slots.pact_slots.max, usedAt(data.pactMagic, slots.pact_slots.level)) },
    inventory,
    player_notes: null,
    source_url: data.id ? `https://www.dndbeyond.com/characters/${data.id}` : null,
  }

  const avatar = data.decorations?.avatarUrl
  const hp = clampInt(maxHp, 1, 100_000)
  return {
    name: (data.name?.trim() || 'Unnamed hero').slice(0, 80),
    is_player: true,
    initiative_bonus: clampInt(mod('dex') + sum('bonus', 'initiative'), -20, 30),
    max_hp: hp,
    current_hp: hp,
    armor_class: clampInt(ac, 0, 50),
    image_url: avatar && avatar.startsWith('https://') ? avatar : null,
    sheet,
  }
}
