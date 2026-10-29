import { toRoman } from './format'

describe('toRoman', () => {
  it('writes the rounds a fight actually reaches', () => {
    expect([1, 2, 3, 4, 5, 9, 10, 12, 14, 19, 20, 40, 49].map(toRoman)).toEqual([
      'I', 'II', 'III', 'IV', 'V', 'IX', 'X', 'XII', 'XIV', 'XIX', 'XX', 'XL', 'XLIX',
    ])
  })

  it('handles the subtractive pairs at every scale', () => {
    expect(toRoman(3999)).toBe('MMMCMXCIX')
    expect(toRoman(1994)).toBe('MCMXCIV')
  })

  it('falls back to digits where there is no numeral', () => {
    expect(toRoman(0)).toBe('0')
    expect(toRoman(-3)).toBe('-3')
    expect(toRoman(4000)).toBe('4000')
    expect(toRoman(2.5)).toBe('2.5')
  })
})
