import { abilityModifier } from './sheet'

/**
 * Reads a monster stat block pasted as text: from D&D Beyond, a PDF or a book
 * page. Understands the 2014 layout ("Armor Class 15 (leather armor)", "Hit
 * Points 7 (2d6)", ability scores as "14 (+2)") and the 2024 one ("AC 15",
 * "Initiative +2 (12)", "HP 7 (2d6)", "Dex 14 +2 +2"). Anything it can't find
 * stays empty for the DM to fill in.
 */
export interface StatBlock {
  name: string | null
  armor_class: number | null
  max_hp: number | null
  /** The hit dice behind max_hp, "2d6" or "7d10 + 21", for rolling instead of taking the average. */
  hp_dice: string | null
  initiative_bonus: number | null
  /** The whole text, tidied, for the DM notes. */
  notes: string
}

/** Typographic minus signs and dashes, as PDFs and D&D Beyond print them. */
const normalize = (text: string) => text.replace(/[\u2212\u2012\u2013\u2014]/g, '-').replace(/\u00a0/g, ' ')

const signed = (s: string) => Number(s.replace(/\s+/g, ''))

export function parseStatBlock(raw: string): StatBlock {
  const text = normalize(raw).trim()
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  const ac = /\b(?:Armor Class|AC)\s+(\d{1,2})\b/i.exec(text)
  const hp = /\b(?:Hit Points|HP)\s+(\d{1,5})(?:\s*\(([^)]+)\))?/i.exec(text)
  const dice = hp?.[2]?.trim()

  let initiative: number | null = null
  const init = /\bInitiative\s+([+-]\s*\d{1,2})\b/i.exec(text)
  if (init) {
    initiative = signed(init[1]!)
  } else {
    // 2014 blocks: the Dex modifier, either "DEX 14 (+2)" on one line or "DEX" over "14 (+2)".
    const dex = /\bDEX\b\s*(?:\n\s*)?(\d{1,2})\s*\(\s*([+-]?\s*\d{1,2})\s*\)/i.exec(text) ?? /\bDex\s+(\d{1,2})\s+([+-]\d{1,2})\b/i.exec(text)
    if (dex) initiative = dex[2] ? signed(dex[2]) : abilityModifier(Number(dex[1]))
    else {
      // A row of six scores under STR DEX CON INT WIS CHA headings: the second is Dex.
      const row = /\bSTR\s+DEX\s+CON\s+INT\s+WIS\s+CHA\s*\n?\s*(\d{1,2})\s*\([^)]*\)\s*(\d{1,2})\s*\(\s*([+-]?\s*\d{1,2})\s*\)/i.exec(text)
      if (row) initiative = signed(row[3]!)
    }
  }

  // The name is the first line that isn't a heading word or a statistic.
  const name = lines.find((l) => !/^(armor class|ac|hit points|hp|speed|str|dex|initiative)\b/i.test(l) && l.length <= 80) ?? null

  return {
    name,
    armor_class: ac ? Number(ac[1]) : null,
    max_hp: hp ? Number(hp[1]) : null,
    hp_dice: dice && /\d+d\d+/i.test(dice) ? dice.replace(/\s+/g, '') : null,
    initiative_bonus: initiative,
    notes: lines.join('\n').slice(0, 4000),
  }
}
