import type { Ability, CharacterSheet, ClassLevel, Proficiency, Skill, SpellSlots } from './types'

// 5e rules for character sheets: what's derived from the stored scores and
// proficiencies. Shared by the sheet screens and the D&D Beyond import.

export const ABILITIES: { key: Ability; label: string; name: string }[] = [
  { key: 'str', label: 'Str', name: 'Strength' },
  { key: 'dex', label: 'Dex', name: 'Dexterity' },
  { key: 'con', label: 'Con', name: 'Constitution' },
  { key: 'int', label: 'Int', name: 'Intelligence' },
  { key: 'wis', label: 'Wis', name: 'Wisdom' },
  { key: 'cha', label: 'Cha', name: 'Charisma' },
]

export const SKILLS: { key: Skill; name: string; ability: Ability }[] = [
  { key: 'acrobatics', name: 'Acrobatics', ability: 'dex' },
  { key: 'animal-handling', name: 'Animal Handling', ability: 'wis' },
  { key: 'arcana', name: 'Arcana', ability: 'int' },
  { key: 'athletics', name: 'Athletics', ability: 'str' },
  { key: 'deception', name: 'Deception', ability: 'cha' },
  { key: 'history', name: 'History', ability: 'int' },
  { key: 'insight', name: 'Insight', ability: 'wis' },
  { key: 'intimidation', name: 'Intimidation', ability: 'cha' },
  { key: 'investigation', name: 'Investigation', ability: 'int' },
  { key: 'medicine', name: 'Medicine', ability: 'wis' },
  { key: 'nature', name: 'Nature', ability: 'int' },
  { key: 'perception', name: 'Perception', ability: 'wis' },
  { key: 'performance', name: 'Performance', ability: 'cha' },
  { key: 'persuasion', name: 'Persuasion', ability: 'cha' },
  { key: 'religion', name: 'Religion', ability: 'int' },
  { key: 'sleight-of-hand', name: 'Sleight of Hand', ability: 'dex' },
  { key: 'stealth', name: 'Stealth', ability: 'dex' },
  { key: 'survival', name: 'Survival', ability: 'wis' },
]

export const ABILITY_KEYS = ABILITIES.map((a) => a.key)
export const SKILL_KEYS = SKILLS.map((s) => s.key)

export function emptySheet(): CharacterSheet {
  return {
    species: null,
    background: null,
    classes: [],
    speed: 30,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saves: [],
    skills: {},
    spellcasting_ability: null,
    spell_slots: [],
    pact_slots: null,
    inventory: [],
    player_notes: null,
    source_url: null,
  }
}

export const abilityModifier = (score: number) => Math.floor((score - 10) / 2)

export const totalLevel = (classes: readonly ClassLevel[]) => classes.reduce((sum, c) => sum + c.level, 0)

/** +2 at levels 1–4, rising by one every four levels. */
export const proficiencyBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4)

const PROFICIENCY_MULTIPLIER: Record<Proficiency, number> = { proficient: 1, expertise: 2 }

export function saveBonus(sheet: CharacterSheet, ability: Ability): number {
  const prof = sheet.saves.includes(ability) ? proficiencyBonus(totalLevel(sheet.classes)) : 0
  return abilityModifier(sheet.abilities[ability]) + prof
}

export function skillBonus(sheet: CharacterSheet, skill: Skill): number {
  const ability = SKILLS.find((s) => s.key === skill)!.ability
  const level = sheet.skills[skill]
  const prof = level ? proficiencyBonus(totalLevel(sheet.classes)) * PROFICIENCY_MULTIPLIER[level] : 0
  return abilityModifier(sheet.abilities[ability]) + prof
}

export const passivePerception = (sheet: CharacterSheet) => 10 + skillBonus(sheet, 'perception')

export function spellSaveDc(sheet: CharacterSheet): number | null {
  const ability = sheet.spellcasting_ability
  return ability ? 8 + proficiencyBonus(totalLevel(sheet.classes)) + abilityModifier(sheet.abilities[ability]) : null
}

export function spellAttackBonus(sheet: CharacterSheet): number | null {
  const ability = sheet.spellcasting_ability
  return ability ? proficiencyBonus(totalLevel(sheet.classes)) + abilityModifier(sheet.abilities[ability]) : null
}

/** "Druid 10", or "Fighter 5 / Wizard 2" for a multiclass. */
export function classSummary(classes: readonly ClassLevel[]): string {
  return classes.map((c) => `${c.name} ${c.level}`).join(' / ')
}

// ─── Spell slots ─────────────────────────────────────────────────────────────

/** Slots per spell level for each caster level (the multiclass spellcaster table). */
const SLOT_TABLE: number[][] = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

const FULL_CASTERS = new Set(['bard', 'cleric', 'druid', 'sorcerer', 'wizard'])
const HALF_CASTERS = new Set(['paladin', 'ranger', 'artificer'])
const THIRD_CASTER_SUBCLASSES = new Set(['eldritch knight', 'arcane trickster'])

export const CASTING_ABILITY: Record<string, Ability> = {
  artificer: 'int',
  bard: 'cha',
  cleric: 'wis',
  druid: 'wis',
  paladin: 'cha',
  ranger: 'wis',
  sorcerer: 'cha',
  warlock: 'cha',
  wizard: 'int',
}

/** How much one class adds to the shared caster level. A single class rounds up; multiclassing rounds down. */
function casterLevels(c: ClassLevel, single: boolean): number {
  const name = c.name.toLowerCase()
  const round = single ? Math.ceil : Math.floor
  if (FULL_CASTERS.has(name)) return c.level
  if (HALF_CASTERS.has(name)) return round(c.level / 2)
  if (c.subclass && THIRD_CASTER_SUBCLASSES.has(c.subclass.toLowerCase()) && c.level >= 3) return round(c.level / 3)
  return 0
}

function pactSlots(level: number): SpellSlots | null {
  if (level < 1) return null
  const count = level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1
  return { level: Math.min(5, Math.ceil(level / 2)), max: count, used: 0 }
}

/** The slots a set of classes grants, before any are spent. Warlock pact magic is kept separate. */
export function slotsFor(classes: readonly ClassLevel[]): Pick<CharacterSheet, 'spell_slots' | 'pact_slots'> {
  const casters = classes.filter((c) => c.name.toLowerCase() !== 'warlock')
  const level = Math.min(20, casters.reduce((sum, c) => sum + casterLevels(c, casters.length === 1), 0))
  const warlock = classes.find((c) => c.name.toLowerCase() === 'warlock')
  return {
    spell_slots: (SLOT_TABLE[level] ?? []).map((max, i) => ({ level: i + 1, max, used: 0 })),
    pact_slots: warlock ? pactSlots(warlock.level) : null,
  }
}

/** The ability the first spellcasting class uses. */
export function castingAbilityFor(classes: readonly ClassLevel[]): Ability | null {
  for (const c of classes) {
    const ability = CASTING_ABILITY[c.name.toLowerCase()]
    if (ability) return ability
    if (c.subclass && THIRD_CASTER_SUBCLASSES.has(c.subclass.toLowerCase())) return 'int'
  }
  return null
}
