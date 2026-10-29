import { memoryStore } from './store/memory'
import type { Store } from './store/types'
import { WEBP, signedUp, testApp, type Client } from './test/harness'

async function newEncounter(api: Client, title = 'Ambush at Hollow Ford') {
  const res = await api('POST', '/api/encounters', { body: { title, description: 'Rain on the bridge.' } })
  expect(res.status).toBe(201)
  return res.body.id as string
}

async function addCreatures(api: Client, base: string, creatures: object[]) {
  const res = await api('POST', `${base}/creatures`, { body: { creatures } })
  expect(res.status).toBe(201)
  return res.body as { id: string; name: string }[]
}

describe('encounters', () => {
  it('creates, lists, reads and deletes an encounter', async () => {
    const app = testApp()
    const { api } = await signedUp(app)
    const id = await newEncounter(api)

    const list = await api('GET', '/api/encounters')
    expect(list.body).toEqual([expect.objectContaining({ id, title: 'Ambush at Hollow Ford', round: 1, creatures: [] })])

    const one = await api('GET', `/api/encounters/${id}`)
    expect(one.body).toMatchObject({ id, share_enabled: false, active_creature_id: null })
    expect(one.body.share_token).toMatch(/^[0-9a-f]{32}$/)
    expect(one.body).not.toHaveProperty('kind')

    expect((await api('DELETE', `/api/encounters/${id}`)).status).toBe(204)
    expect((await api('GET', `/api/encounters/${id}`)).status).toBe(404)
  })

  it('keeps every account’s encounters to itself', async () => {
    const app = testApp()
    const { api: alice } = await signedUp(app, 'alice@example.com')
    const { api: bob } = await signedUp(app, 'bob@example.com')
    const id = await newEncounter(alice)

    expect((await bob('GET', `/api/encounters/${id}`)).status).toBe(404)
    expect((await bob('PATCH', `/api/encounters/${id}`, { body: { title: 'Mine now' } })).status).toBe(404)
    expect((await bob('GET', '/api/encounters')).body).toEqual([])
    expect((await app.call('GET', '/api/encounters')).status).toBe(401)
  })

  it('runs turns with the shared engine: skips the dead, ticks conditions, counts rounds', async () => {
    const app = testApp()
    const { api } = await signedUp(app)
    const base = `/api/encounters/${await newEncounter(api)}`
    const [vex, goblin, worg] = await addCreatures(api, base, [
      { name: 'Vex', initiative: 20, is_player: true, conditions: [{ key: 'poisoned', rounds: 1 }] },
      { name: 'Goblin', initiative: 15, conditions: [{ key: 'dead', rounds: null }] },
      { name: 'Worg', initiative: 10 },
    ])

    let res = await api('POST', `${base}/turn`, { body: { step: 1 } })
    expect(res.body).toMatchObject({ round: 1, active_creature_id: vex!.id })

    res = await api('POST', `${base}/turn`, { body: { step: 1 } })
    expect(res.body.active_creature_id).toBe(worg!.id)
    expect(res.body.creatures.find((c: { id: string }) => c.id === vex!.id).conditions).toEqual([])
    expect(goblin).toBeDefined()

    res = await api('POST', `${base}/turn`, { body: { step: 1 } })
    expect(res.body).toMatchObject({ round: 2, active_creature_id: vex!.id })

    expect((await api('POST', `${base}/turn`, { body: { step: 2 } })).status).toBe(400)
  })

  it('passes the turn on when the acting creature is removed', async () => {
    const app = testApp()
    const { api } = await signedUp(app)
    const base = `/api/encounters/${await newEncounter(api)}`
    const [a, b] = await addCreatures(api, base, [
      { name: 'A', initiative: 20 },
      { name: 'B', initiative: 10 },
    ])
    await api('POST', `${base}/turn`, { body: { step: 1 } })

    const res = await api('DELETE', `${base}/creatures/${a!.id}`)
    expect(res.body.active_creature_id).toBe(b!.id)
    expect(res.body.creatures.map((c: { name: string }) => c.name)).toEqual(['B'])
  })

  it('updates creatures and rejects bad values with a readable message', async () => {
    const app = testApp()
    const { api } = await signedUp(app)
    const base = `/api/encounters/${await newEncounter(api)}`
    const [orc] = await addCreatures(api, base, [{ name: 'Orc', max_hp: 15, current_hp: 15 }])

    const hit = await api('PATCH', `${base}/creatures/${orc!.id}`, { body: { current_hp: 9, owner_id: 'someone-else' } })
    expect(hit.body).toMatchObject({ current_hp: 9, max_hp: 15 })
    expect(hit.body.owner_id).not.toBe('someone-else')

    const bad = await api('PATCH', `${base}/creatures/${orc!.id}`, { body: { armor_class: 99 } })
    expect(bad).toMatchObject({ status: 400, body: { error: 'Armor class must be between 0 and 50' } })
    expect((await api('PATCH', `${base}/creatures/nope`, { body: { current_hp: 1 } })).status).toBe(404)
    expect((await api('PATCH', base, { body: { active_creature_id: 'not-here' } })).status).toBe(400)
  })

  it('pings live sync with the share token after every change', async () => {
    const app = testApp()
    const { api } = await signedUp(app)
    const id = await newEncounter(api)
    const token = (await api('GET', `/api/encounters/${id}`)).body.share_token
    await addCreatures(api, `/api/encounters/${id}`, [{ name: 'Orc' }])
    await api('POST', `/api/encounters/${id}/turn`, { body: { step: 1 } })
    expect(app.pings).toEqual([token, token])
  })

  it('retries when another device wrote in between, so both edits land', async () => {
    const inner = memoryStore()
    let interfere = false
    // Before the first write lands, a "second device" changes the same encounter.
    const store: Store = {
      ...inner,
      async replaceTable(doc, etag) {
        if (interfere) {
          interfere = false
          const other = (await inner.getTable(doc.owner_id, 'encounter', doc.id))!
          await inner.replaceTable({ ...other.doc, title: 'Renamed elsewhere' }, other.etag)
        }
        return inner.replaceTable(doc, etag)
      },
    }
    const app = testApp({ store })
    const { api } = await signedUp(app)
    const base = `/api/encounters/${await newEncounter(api)}`
    const [orc] = await addCreatures(api, base, [{ name: 'Orc', max_hp: 15, current_hp: 15 }])

    interfere = true
    await api('PATCH', `${base}/creatures/${orc!.id}`, { body: { current_hp: 4 } })
    const now = (await api('GET', base)).body
    expect(now.title).toBe('Renamed elsewhere')
    expect(now.creatures[0].current_hp).toBe(4)
  })
})

describe('presets', () => {
  it('launches into a fresh encounter: monsters roll, players keep initiative, everyone at full HP', async () => {
    const app = testApp()
    const { api } = await signedUp(app)
    const created = await api('POST', '/api/presets', { body: { name: 'The party' } })
    const base = `/api/presets/${created.body.id}`
    await addCreatures(api, base, [
      { name: 'Thorne', is_player: true, initiative: 8, max_hp: 44, current_hp: 12 },
      { name: 'Wolf', initiative_bonus: 2, max_hp: 11, current_hp: 3 },
    ])

    const launched = await api('POST', `${base}/launch`)
    const encounter = (await api('GET', `/api/encounters/${launched.body.id}`)).body
    const thorne = encounter.creatures.find((c: { name: string }) => c.name === 'Thorne')
    const wolf = encounter.creatures.find((c: { name: string }) => c.name === 'Wolf')
    expect(encounter.title).toBe('The party')
    expect(thorne).toMatchObject({ initiative: 8, current_hp: 44, encounter_id: launched.body.id, preset_id: null })
    expect(wolf.initiative).toBeGreaterThanOrEqual(3)
    expect(wolf.initiative).toBeLessThanOrEqual(22)
    expect(wolf.current_hp).toBe(11)

    // The preset itself is untouched.
    expect((await api('GET', base)).body.creatures).toHaveLength(2)
  })
})

describe('player view', () => {
  async function shared() {
    const app = testApp()
    const { api, user } = await signedUp(app)
    const id = await newEncounter(api)
    await addCreatures(api, `/api/encounters/${id}`, [
      { name: 'Vex', is_player: true, initiative: 18, max_hp: 33, current_hp: 27, armor_class: 15, notes: 'Player secret' },
      { name: 'Ogre', initiative: 12, max_hp: 59, current_hp: 20, armor_class: 11, notes: 'Weak to fire' },
    ])
    const token = (await api('GET', `/api/encounters/${id}`)).body.share_token as string
    return { app, api, user, id, token }
  }

  it('is closed until the DM turns sharing on', async () => {
    const { app, api, id, token } = await shared()
    expect((await app.call('GET', `/api/play/${token}`)).status).toBe(404)
    await api('PATCH', `/api/encounters/${id}`, { body: { share_enabled: true } })
    expect((await app.call('GET', `/api/play/${token}`)).status).toBe(200)
  })

  it('never sends notes, monster HP or monster AC', async () => {
    const { app, api, id, token } = await shared()
    await api('PATCH', `/api/encounters/${id}`, { body: { share_enabled: true } })
    const view = (await app.call('GET', `/api/play/${token}`)).body
    expect(JSON.stringify(view)).not.toMatch(/secret|fire/i)
    expect(view.creatures.map((c: { name: string }) => c.name)).toEqual(['Vex', 'Ogre'])
    expect(view.creatures[0]).toMatchObject({ current_hp: 27, max_hp: 33, armor_class: 15, health: 'wounded' })
    expect(view.creatures[1]).toMatchObject({ current_hp: null, max_hp: null, armor_class: null, health: 'bloodied' })
  })

  it('hands out live sync to anyone while shared, and only to the owner otherwise', async () => {
    const { app, api, token } = await shared()
    expect((await app.call('GET', `/api/live/${token}`)).status).toBe(404)
    expect((await api('GET', `/api/live/${token}`)).body).toEqual({ url: `wss://live.test/${token}` })
    expect((await app.call('GET', '/api/live/not-a-token')).status).toBe(404)
  })
})

describe('images', () => {
  it('stores WebP uploads under the uploader’s folder', async () => {
    const app = testApp()
    const { api, user } = await signedUp(app)
    const res = await api('POST', '/api/images?kind=portrait', { raw: WEBP })
    expect(res.status).toBe(201)
    expect(res.body.url).toMatch(new RegExp(`^https://images\\.test/${user.id}/portrait-[0-9a-f-]+\\.webp$`))
  })

  it('refuses anything that isn’t WebP, unknown kinds, and anonymous uploads', async () => {
    const app = testApp()
    const { api } = await signedUp(app)
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect((await api('POST', '/api/images?kind=portrait', { raw: png })).status).toBe(415)
    expect((await api('POST', '/api/images?kind=avatar', { raw: WEBP })).status).toBe(400)
    expect((await app.call('POST', '/api/images?kind=portrait', { raw: WEBP })).status).toBe(401)
  })
})
