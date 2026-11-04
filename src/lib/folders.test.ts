import { groupEncounters } from './folders'

const e = (id: string, campaign_id: string | null, live = false) => ({ id, campaign_id, live })

describe('groupEncounters', () => {
  it('puts live encounters first, then folders in preset order, then the rest', () => {
    const grouped = groupEncounters(
      [e('a', null), e('b', 'p2'), e('c', 'p1', true), e('d', 'p1'), e('f', null, true)],
      [
        { id: 'p1', name: 'Phandelver' },
        { id: 'p2', name: 'Strahd' },
        { id: 'p3', name: 'Empty' },
      ],
    )
    expect(grouped.live.map((x) => x.id)).toEqual(['c', 'f'])
    expect(grouped.folders.map((f) => [f.name, f.encounters.map((x) => x.id)])).toEqual([
      ['Phandelver', ['d']],
      ['Strahd', ['b']],
    ])
    expect(grouped.loose.map((x) => x.id)).toEqual(['a'])
  })

  it('keeps encounters whose folder it can’t name', () => {
    expect(groupEncounters([e('a', 'gone')], [], 'Campaign').folders).toEqual([{ id: 'gone', name: 'Campaign', encounters: [e('a', 'gone')] }])
  })
})
