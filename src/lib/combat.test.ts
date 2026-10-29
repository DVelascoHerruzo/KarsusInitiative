import { advanceTurn, applyDamage, applyHealing, grantTempHp, healthBand, nextUp, numberedNames, sortByInitiative, turnDirection } from './combat'
import type { Condition } from './types'

function c(id: string, initiative: number, extra: { bonus?: number; conditions?: Condition[]; at?: string } = {}) {
  return {
    id,
    initiative,
    initiative_bonus: extra.bonus ?? 0,
    created_at: extra.at ?? `2026-01-01T00:00:0${id.length}Z`,
    conditions: extra.conditions ?? [],
  }
}

describe('sortByInitiative', () => {
  it('orders by initiative, then bonus, then insertion', () => {
    const list = [
      c('a', 12),
      c('b', 15, { bonus: 1 }),
      c('c', 15, { bonus: 3 }),
      c('d', 12, { at: '2025-01-01T00:00:00Z' }),
    ]
    expect(sortByInitiative(list).map((x) => x.id)).toEqual(['c', 'b', 'd', 'a'])
  })
})

describe('advanceTurn', () => {
  const vex = c('vex', 18, { conditions: [{ key: 'blessed', rounds: 2 }, { key: 'prone', rounds: null }] })
  const goblin = c('goblin', 15, { bonus: 2 })
  const boss = c('boss', 15, { bonus: 1, conditions: [{ key: 'dead', rounds: null }] })
  const thorne = c('thorne', 12)
  const start = { round: 1, activeId: null, creatures: [thorne, boss, vex, goblin] }

  it('runs a full round the way the API does', () => {
    let s = advanceTurn(start, 1)
    expect(s).toMatchObject({ activeId: 'vex', round: 1 })

    s = advanceTurn(s, 1)
    expect(s.activeId).toBe('goblin')
    expect(s.creatures.find((x) => x.id === 'vex')!.conditions).toEqual([
      { key: 'blessed', rounds: 1 },
      { key: 'prone', rounds: null },
    ])

    s = advanceTurn(s, 1)
    expect(s.activeId).toBe('thorne') // dead boss skipped

    s = advanceTurn(s, 1)
    expect(s).toMatchObject({ activeId: 'vex', round: 2 })

    s = advanceTurn(s, 1)
    expect(s.creatures.find((x) => x.id === 'vex')!.conditions).toEqual([{ key: 'prone', rounds: null }])

    s = advanceTurn(advanceTurn(s, -1), -1)
    expect(s).toMatchObject({ activeId: 'thorne', round: 1 })
  })

  it('never drops the round below 1', () => {
    expect(advanceTurn({ ...start, activeId: 'vex' }, -1)).toMatchObject({ activeId: 'thorne', round: 1 })
  })

  it('handles an empty encounter', () => {
    expect(advanceTurn({ round: 3, activeId: 'gone', creatures: [] }, 1)).toMatchObject({ activeId: null, round: 3 })
  })
})

describe('hit points', () => {
  const base = { name: 'Goblin', is_player: false, current_hp: 10, max_hp: 10, temp_hp: 0, conditions: [] as Condition[] }

  it('burns temp HP first', () => {
    expect(applyDamage({ ...base, temp_hp: 4 }, 6).patch).toMatchObject({ temp_hp: 0, current_hp: 8 })
  })

  it('marks monsters dead and players unconscious at 0, ending concentration', () => {
    const conc = [{ key: 'concentrating', rounds: null }]
    const monster = applyDamage({ ...base, conditions: conc }, 15)
    expect(monster.droppedToZero).toBe(true)
    expect(monster.patch).toMatchObject({ current_hp: 0, conditions: [{ key: 'dead', rounds: null }] })

    const pc = applyDamage({ ...base, is_player: true }, 99)
    expect(pc.patch.conditions).toEqual([{ key: 'unconscious', rounds: null }])
  })

  it('calls for a concentration save with the right DC', () => {
    const conc = { ...base, current_hp: 40, max_hp: 40, conditions: [{ key: 'concentrating', rounds: null }] }
    expect(applyDamage(conc, 7).concentrationDc).toBe(10)
    expect(applyDamage(conc, 25).concentrationDc).toBe(12)
  })

  it('ignores creatures without tracked HP and zero amounts', () => {
    expect(applyDamage({ ...base, current_hp: null }, 5).patch).toEqual({})
    expect(applyHealing(base, 0).patch).toEqual({})
  })

  it('heals up to max and revives from 0', () => {
    expect(applyHealing({ ...base, current_hp: 8 }, 5).patch).toEqual({ current_hp: 10 })
    const downed = { ...base, current_hp: 0, conditions: [{ key: 'unconscious', rounds: null }, { key: 'prone', rounds: null }] }
    expect(applyHealing(downed, 3).patch).toEqual({ current_hp: 3, conditions: [{ key: 'prone', rounds: null }] })
  })

  it('does not stack temp HP', () => {
    expect(grantTempHp({ temp_hp: 5 }, 3).patch).toEqual({})
    expect(grantTempHp({ temp_hp: 5 }, 8).patch).toEqual({ temp_hp: 8 })
  })

  it('bands health like the player view', () => {
    expect([10, 9, 5, 2, 0].map((hp) => healthBand(hp, 10))).toEqual(['healthy', 'wounded', 'bloodied', 'critical', 'down'])
    expect(healthBand(null, 10)).toBeNull()
  })
})

describe('numberedNames', () => {
  it('numbers groups and continues existing sequences', () => {
    expect(numberedNames('Goblin', 1, [])).toEqual(['Goblin'])
    expect(numberedNames('Goblin', 3, [])).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3'])
    expect(numberedNames('Goblin', 2, ['Goblin 1', 'Goblin 4'])).toEqual(['Goblin 5', 'Goblin 6'])
    expect(numberedNames('Goblin', 1, ['Goblin'])).toEqual(['Goblin 1'])
  })
})

describe('nextUp', () => {
  const list = [c('vex', 18), c('boss', 15, { conditions: [{ key: 'dead', rounds: null }] }), c('goblin', 12), c('thorne', 8)]

  it('is the first living creature before combat starts', () => {
    expect(nextUp(list, null)?.id).toBe('vex')
  })

  it('skips the dead and wraps to the top of the order', () => {
    expect(nextUp(list, 'vex')?.id).toBe('goblin')
    expect(nextUp(list, 'thorne')?.id).toBe('vex')
  })

  it('is nobody when everyone else is down', () => {
    expect(nextUp([c('vex', 18), c('boss', 15, { conditions: [{ key: 'dead', rounds: null }] })], 'vex')).toBeNull()
  })
})

describe('turnDirection', () => {
  it('is forward when the turn steps down the order', () => {
    expect(turnDirection({ round: 2, index: 1 }, { round: 2, index: 2 })).toBe(1)
  })

  it('is forward when the order wraps into a new round', () => {
    expect(turnDirection({ round: 2, index: 6 }, { round: 3, index: 0 })).toBe(1)
  })

  it('is backward for a previous turn, including back across a round', () => {
    expect(turnDirection({ round: 2, index: 2 }, { round: 2, index: 1 })).toBe(-1)
    expect(turnDirection({ round: 3, index: 0 }, { round: 2, index: 6 })).toBe(-1)
  })

  it('is forward when combat starts', () => {
    expect(turnDirection({ round: 1, index: -1 }, { round: 1, index: 0 })).toBe(1)
  })
})
