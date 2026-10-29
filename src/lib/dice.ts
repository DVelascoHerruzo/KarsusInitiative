export type RandomInt = (sides: number) => number

/** Unbiased 1..sides using rejection sampling over crypto random bytes. */
export const cryptoRoll: RandomInt = (sides) => {
  const limit = Math.floor(0x1_0000_0000 / sides) * sides
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0]! >= limit)
  return (buf[0]! % sides) + 1
}

export interface DiceTerm {
  kind: 'dice'
  sign: 1 | -1
  count: number
  sides: number
  keep?: { mode: 'h' | 'l'; n: number }
}
export interface FlatTerm {
  kind: 'flat'
  sign: 1 | -1
  value: number
}
export type Term = DiceTerm | FlatTerm

export interface RolledTerm {
  term: Term
  rolls: number[]
  kept: boolean[]
  subtotal: number
}

export interface RollResult {
  notation: string
  total: number
  terms: RolledTerm[]
  /** Only meaningful for a single kept d20 (attack rolls, saves, checks). */
  natural?: number
}

export class DiceSyntaxError extends Error {}

const TERM = /^(\d*)d(\d+|%)(?:k([hl])(\d*))?$|^(\d+)$/

const MAX_DICE = 100
const MAX_SIDES = 1000

/** Parses notation like `2d6+3`, `d20`, `2d20kh1 + 5`, `4d6kh3`, `d%`. */
export function parseDice(input: string): Term[] {
  const src = input.toLowerCase().replace(/\s+/g, '')
  if (!src) throw new DiceSyntaxError('Enter a roll like 2d6+3')

  const parts = src.match(/[+-]?[^+-]+/g) ?? []
  if (parts.join('') !== src) throw new DiceSyntaxError(`Can’t read “${input}”`)

  return parts.map((raw): Term => {
    const sign = raw.startsWith('-') ? -1 : 1
    const body = raw.replace(/^[+-]/, '')
    const m = TERM.exec(body)
    if (!m) throw new DiceSyntaxError(`Can’t read “${body}”`)

    if (m[5] !== undefined) return { kind: 'flat', sign, value: Number(m[5]) }

    const count = m[1] ? Number(m[1]) : 1
    const sides = m[2] === '%' ? 100 : Number(m[2])
    if (count < 1 || count > MAX_DICE) throw new DiceSyntaxError(`Roll between 1 and ${MAX_DICE} dice`)
    if (sides < 2 || sides > MAX_SIDES) throw new DiceSyntaxError(`Dice need 2–${MAX_SIDES} sides`)

    const term: DiceTerm = { kind: 'dice', sign, count, sides }
    if (m[3]) {
      const n = m[4] ? Number(m[4]) : 1
      if (n < 1 || n > count) throw new DiceSyntaxError(`Can’t keep ${n} of ${count} dice`)
      term.keep = { mode: m[3] as 'h' | 'l', n }
    }
    return term
  })
}

export function rollDice(notation: string, random: RandomInt = cryptoRoll): RollResult {
  const terms = parseDice(notation).map((term): RolledTerm => {
    if (term.kind === 'flat') return { term, rolls: [], kept: [], subtotal: term.sign * term.value }

    const rolls = Array.from({ length: term.count }, () => random(term.sides))
    let kept = rolls.map(() => true)
    if (term.keep) {
      const order = rolls.map((v, i) => ({ v, i })).sort((a, b) => (term.keep!.mode === 'h' ? b.v - a.v : a.v - b.v))
      const keepIdx = new Set(order.slice(0, term.keep.n).map((o) => o.i))
      kept = rolls.map((_, i) => keepIdx.has(i))
    }
    const sum = rolls.reduce((acc, v, i) => acc + (kept[i] ? v : 0), 0)
    return { term, rolls, kept, subtotal: term.sign * sum }
  })

  const dice = terms.filter((t) => t.term.kind === 'dice')
  const single = dice.length === 1 ? dice[0]! : undefined
  const isD20 = single?.term.kind === 'dice' && single.term.sides === 20 && single.kept.filter(Boolean).length === 1

  return {
    notation: formatTerms(terms.map((t) => t.term)),
    total: terms.reduce((acc, t) => acc + t.subtotal, 0),
    terms,
    ...(isD20 ? { natural: single!.rolls[single!.kept.indexOf(true)]! } : {}),
  }
}

export function formatTerms(terms: readonly Term[]): string {
  return terms
    .map((t, i) => {
      const sign = t.sign === -1 ? '−' : i === 0 ? '' : '+'
      const body =
        t.kind === 'flat' ? String(t.value) : `${t.count}d${t.sides}${t.keep ? `k${t.keep.mode}${t.keep.n}` : ''}`
      return i === 0 ? `${sign}${body}` : ` ${sign} ${body}`
    })
    .join('')
}

/** d20 + modifier, with an optional advantage / disadvantage mode. */
export function d20Notation(modifier: number, mode: 'normal' | 'advantage' | 'disadvantage' = 'normal'): string {
  const die = mode === 'advantage' ? '2d20kh1' : mode === 'disadvantage' ? '2d20kl1' : 'd20'
  if (modifier === 0) return die
  return `${die}${modifier > 0 ? '+' : '-'}${Math.abs(modifier)}`
}

export function formatModifier(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`
}
