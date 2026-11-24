import { signedUp, testApp, verifyToken, type Client, type TestApp } from './test/harness'

const DAY = 24 * 60 * 60 * 1000

/** A browser with no account that has started its guest encounter. */
async function guest(app: TestApp) {
  const api = app.client()
  const res = await api('POST', '/api/guest')
  expect(res.status).toBe(201)
  return { api, id: res.body.encounter.id as string, res }
}

async function addGoblin(api: Client, id: string) {
  const res = await api('POST', `/api/encounters/${id}/creatures`, { body: { creatures: [{ name: 'Goblin', initiative: 12, max_hp: 7 }] } })
  expect(res.status).toBe(201)
  return res.body[0] as { id: string }
}

const stored = (app: TestApp) => app.dump() as { id: string; kind: string; owner_id?: string; ttl?: number; expires_at?: string }[]

describe('guests', () => {
  it('get an empty encounter of their own, for seven days', async () => {
    const app = testApp()
    const { api, id, res } = await guest(app)
    expect(res.body.encounter).toMatchObject({ id, title: 'New encounter', creatures: [], share_enabled: false })
    expect(res.body.encounter).not.toHaveProperty('expires_at')
    expect(res.body.encounter).not.toHaveProperty('ttl')
    const left = Date.parse(res.body.guest.expires_at) - Date.now()
    expect(left).toBeGreaterThan(7 * DAY - 60_000)
    expect(left).toBeLessThanOrEqual(7 * DAY)
    expect(res.cookies).toEqual([expect.objectContaining({ name: 'karsus_guest', httpOnly: true, path: '/api' })])

    // Asking again (another tab, a reload) gives the same one, not a new one.
    const again = await api('POST', '/api/guest')
    expect(again.status).toBe(200)
    expect(again.body.encounter.id).toBe(id)
    expect((await api('GET', '/api/auth/me')).body).toMatchObject({ user: null, guest: { encounter_id: id } })
  })

  it('run the encounter like anyone else: creatures, turns, and a player view link', async () => {
    const app = testApp()
    const { api, id } = await guest(app)
    const goblin = await addGoblin(api, id)
    expect((await api('PATCH', `/api/encounters/${id}/creatures/${goblin.id}`, { body: { current_hp: 3 } })).status).toBe(200)
    expect((await api('POST', `/api/encounters/${id}/turn`, { body: { step: 1 } })).body.active_creature_id).toBe(goblin.id)

    const shared = await api('PATCH', `/api/encounters/${id}`, { body: { share_enabled: true, title: 'Bridge ambush' } })
    const token = shared.body.share_token as string
    // Another device, with no cookies at all, follows along.
    const table = await app.client()('GET', `/api/play/${token}`)
    expect(table.status).toBe(200)
    expect(table.body).toMatchObject({ title: 'Bridge ambush', creatures: [expect.objectContaining({ name: 'Goblin' })] })
    expect((await api('GET', `/api/live/${token}`)).status).toBe(200)
  })

  it('stay inside their own encounter: no lists, campaigns, folders, uploads or other people’s tables', async () => {
    const app = testApp()
    const { api } = await guest(app)
    for (const [method, path] of [
      ['GET', '/api/encounters'],
      ['POST', '/api/encounters'],
      ['GET', '/api/presets'],
      ['POST', '/api/presets'],
      ['GET', '/api/folders'],
      ['POST', '/api/images?kind=portrait'],
      ['GET', '/api/player'],
    ] as const) {
      expect([method, path, (await api(method, path, { body: { title: 'x', name: 'x' } })).status]).toEqual([method, path, 401])
    }

    const other = await guest(app)
    expect((await api('GET', `/api/encounters/${other.id}`)).status).toBe(404)
    const { api: dm } = await signedUp(app)
    const mine = (await dm('POST', '/api/encounters', { body: { title: 'Mine' } })).body.id
    expect((await api('GET', `/api/encounters/${mine}`)).status).toBe(404)
    expect((await api('GET', `/api/encounters/${mine}/view`)).status).toBe(401)
  })

  it('stores the encounter, its locator and its link to expire together', async () => {
    const app = testApp()
    const { api, id } = await guest(app)
    await addGoblin(api, id)
    const docs = stored(app).filter((d) => d.id === id || d.id === `table:${id}` || d.kind === 'share')
    expect(docs).toHaveLength(3)
    for (const d of docs) {
      expect(d.ttl).toBeGreaterThan(7 * 24 * 3600 - 60)
      expect(d.ttl).toBeLessThanOrEqual(7 * 24 * 3600)
    }
  })

  it('lose the encounter and its link once the seven days are up', async () => {
    const app = testApp()
    const { api, id } = await guest(app)
    const token = (await api('PATCH', `/api/encounters/${id}`, { body: { share_enabled: true } })).body.share_token
    app.s.now = () => new Date(Date.now() + 8 * DAY)
    expect((await api('GET', `/api/encounters/${id}`)).status).toBe(404)
    expect((await app.client()('GET', `/api/play/${token}`)).status).toBe(404)
  })

  it('can start over, which deletes the encounter and its link', async () => {
    const app = testApp()
    const { api, id } = await guest(app)
    const token = (await api('PATCH', `/api/encounters/${id}`, { body: { share_enabled: true } })).body.share_token
    const res = await api('DELETE', '/api/guest')
    expect(res.status).toBe(204)
    expect((await api('GET', '/api/auth/me')).body.guest).toBeNull()
    expect((await app.client()('GET', `/api/play/${token}`)).status).toBe(404)
    expect((await api('POST', '/api/guest')).body.encounter.id).not.toBe(id)
  })

  it('keep the encounter by signing up: same id, same player link, no expiry', async () => {
    const app = testApp()
    const { api, id } = await guest(app)
    const goblin = await addGoblin(api, id)
    const token = (await api('PATCH', `/api/encounters/${id}`, { body: { share_enabled: true } })).body.share_token

    const signup = await api('POST', '/api/auth/signup', { body: { email: 'new@example.com', username: 'Newcomer', password: 'correct horse battery' } })
    expect(signup.status).toBe(201)
    expect(signup.body.adopted).toBe(1)
    expect((await api('GET', '/api/auth/me')).body.guest).toBeNull()
    expect((await api('POST', '/api/auth/verify', { body: { token: verifyToken(app, 'new@example.com') } })).status).toBe(200)

    const list = await api('GET', '/api/encounters')
    expect(list.body).toEqual([expect.objectContaining({ id })])
    const moved = await api('GET', `/api/encounters/${id}`)
    expect(moved.body).toMatchObject({ owner_id: signup.body.user.id, share_token: token, creatures: [expect.objectContaining({ id: goblin.id, owner_id: signup.body.user.id })] })
    // The TV showing the player view carries on.
    expect((await app.client()('GET', `/api/play/${token}`)).status).toBe(200)
    // Nothing left behind under the guest, and nothing set to expire.
    const docs = stored(app)
    expect(docs.filter((d) => d.owner_id?.startsWith('guest-'))).toEqual([])
    expect(docs.filter((d) => d.id === id || d.id === `table:${id}` || d.kind === 'share').every((d) => d.ttl === undefined && d.expires_at === undefined)).toBe(true)
  })

  it('keep the encounter by signing in to an existing account too', async () => {
    const app = testApp()
    await signedUp(app, 'dm@example.com')
    const { api, id } = await guest(app)
    await addGoblin(api, id)
    const signin = await api('POST', '/api/auth/signin', { body: { email: 'dm@example.com', password: 'correct horse battery' } })
    expect(signin.body.adopted).toBe(1)
    expect((await api('GET', '/api/encounters')).body.map((e: { id: string }) => e.id)).toContain(id)
  })

  it('aren’t a thing for someone signed in', async () => {
    const app = testApp()
    const { api } = await signedUp(app)
    expect((await api('POST', '/api/guest')).status).toBe(409)
  })
})
