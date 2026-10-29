import { DiceSyntaxError, cryptoRoll, d20Notation, parseDice, rollDice, type RandomInt } from './dice'

/** Returns the queued values in order, so rolls are deterministic. */
function scripted(...values: number[]): RandomInt {
  return () => {
    const v = values.shift()
    if (v === undefined) throw new Error('ran out of scripted rolls')
    return v
  }
}

describe('parseDice', () => {
  it('reads dice, modifiers and keep rules', () => {
    expect(parseDice('2d6 + 3')).toEqual([
      { kind: 'dice', sign: 1, count: 2, sides: 6 },
      { kind: 'flat', sign: 1, value: 3 },
    ])
    expect(parseDice('d20')).toEqual([{ kind: 'dice', sign: 1, count: 1, sides: 20 }])
    expect(parseDice('4d6kh3')[0]).toMatchObject({ keep: { mode: 'h', n: 3 } })
    expect(parseDice('2d20kl')[0]).toMatchObject({ keep: { mode: 'l', n: 1 } })
    expect(parseDice('d%')[0]).toMatchObject({ sides: 100 })
    expect(parseDice('1d8-1')[1]).toEqual({ kind: 'flat', sign: -1, value: 1 })
  })

  it.each(['', 'fireball', '2d', 'd1', '0d6', '1000d6', '2d6kh3', '2d6++1', '3x4'])('rejects %j', (bad) => {
    expect(() => parseDice(bad)).toThrow(DiceSyntaxError)
  })
})

describe('rollDice', () => {
  it('totals dice and modifiers', () => {
    const r = rollDice('2d6+3', scripted(4, 5))
    expect(r.total).toBe(12)
    expect(r.natural).toBeUndefined()
  })

  it('keeps the highest d20 for advantage and reports the natural roll', () => {
    const r = rollDice('2d20kh1+5', scripted(3, 17))
    expect(r.total).toBe(22)
    expect(r.natural).toBe(17)
    expect(r.terms[0]!.kept).toEqual([false, true])
  })

  it('keeps the lowest for disadvantage', () => {
    const r = rollDice('2d20kl1', scripted(3, 17))
    expect(r.total).toBe(3)
    expect(r.natural).toBe(3)
  })

  it('subtracts negative dice terms', () => {
    expect(rollDice('10-1d4', scripted(3)).total).toBe(7)
  })
})

describe('cryptoRoll', () => {
  it('stays within bounds and hits every face', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const v = cryptoRoll(6)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
      seen.add(v)
    }
    expect(seen.size).toBe(6)
  })
})

describe('d20Notation', () => {
  it('builds initiative-style notation', () => {
    expect(d20Notation(3)).toBe('d20+3')
    expect(d20Notation(-1, 'advantage')).toBe('2d20kh1-1')
    expect(d20Notation(0, 'disadvantage')).toBe('2d20kl1')
  })
})
