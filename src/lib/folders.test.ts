import { groupEncounters } from './folders'

const e = (id: string, campaign_id: string | null, live = false) => ({ id, campaign_id, live })
const ids = (list: { id: string }[]) => list.map((x) => x.id)

describe('groupEncounters', () => {
  const campaigns = [
    { id: 'p1', name: 'Phandelver' },
    { id: 'p2', name: 'Strahd' },
    { id: 'p3', name: 'Empty' },
  ]

  it('puts live encounters first, then campaigns in order, then the rest', () => {
    const grouped = groupEncounters([e('a', null), e('b', 'p2'), e('c', 'p1', true), e('d', 'p1'), e('f', null, true)], { campaigns })
    expect(ids(grouped.live)).toEqual(['c', 'f'])
    expect(grouped.campaigns.map((f) => [f.name, ids(f.encounters)])).toEqual([
      ['Phandelver', ['d']],
      ['Strahd', ['b']],
    ])
    expect(ids(grouped.loose)).toEqual(['a'])
  })

  it('takes filed encounters out of their campaign and keeps empty folders', () => {
    const grouped = groupEncounters([e('a', null), e('b', 'p1'), e('d', 'p1')], {
      campaigns,
      folders: [
        { id: 'f1', name: 'Session 12' },
        { id: 'f2', name: 'Someday' },
      ],
      filed: { b: 'f1', a: 'f1', d: 'deleted-folder' },
    })
    expect(grouped.folders.map((f) => [f.name, ids(f.encounters)])).toEqual([
      ['Session 12', ['a', 'b']],
      ['Someday', []],
    ])
    expect(grouped.campaigns.map((f) => ids(f.encounters))).toEqual([['d']])
    expect(grouped.loose).toEqual([])
  })

  it('keeps encounters whose campaign it can’t name', () => {
    expect(groupEncounters([e('a', 'gone')], { campaigns: [] }).campaigns).toEqual([{ id: 'gone', name: 'Campaign', encounters: [e('a', 'gone')] }])
  })
})
