import druid from './test/fixtures/dndbeyond-druid.json'
import { characterIdFromUrl, characterJsonUrl, fromDndBeyond, type DdbCharacter } from './domain/dndbeyond'
import { SESSION_COOKIE } from './auth/session'
import { memoryStore } from './store/memory'
import { signedUp, testApp, type Client, type TestApp } from './test/harness'

/** A DM with a campaign: two PCs (one hidden), and a monster with DM notes. */
async function campaign(app: TestApp) {
  const dm = await signedUp(app, 'dm@example.com', 'Morgan')
  const id = (await dm.api('POST', '/api/presets', { body: { name: 'Curse of the Hollow Crown' } })).body.id as string
  const base = `/api/presets/${id}`
  const roster = await dm.api('POST', `${base}/creatures`, {
    body: {
      creatures: [
        { name: 'Vex', is_player: true, initiative: 18, max_hp: 33, armor_class: 15, notes: 'Owes the thieves’ guild' },
        { name: 'Aldric', is_player: true, initiative: 12, max_hp: 31, armor_class: 18 },
        { name: 'Secret Twin', is_player: true, hidden: true },
        { name: 'Hobgoblin', initiative_bonus: 1, max_hp: 39, notes: 'Ambush from the reeds' },
      ],
    },
  })
  const [vex, aldric, twin, hobgoblin] = roster.body as { id: string }[]
  return { dm, id, base, vex: vex!.id, aldric: aldric!.id, twin: twin!.id, hobgoblin: hobgoblin!.id }
}

async function invite(api: Client, base: string, role: 'player' | 'dm') {
  const res = await api('POST', `${base}/invites/${role}`)
  expect(res.status).toBe(200)
  return res.body[role] as string
}

async function join(app: TestApp, token: string, email: string, username: string, choice: object = {}) {
  const who = await signedUp(app, email, username)
  const res = await who.api('POST', `/api/invites/${token}`, { body: choice })
  expect(res.status).toBe(201)
  return who
}

describe('remembering people', () => {
  it('keeps the side of the table they were on last', async () => {
    const app = testApp()
    const { api, user } = await signedUp(app)
    expect(user.mode).toBe('dm')
    expect((await api('PATCH', '/api/auth/me', { body: { mode: 'player' } })).body.user.mode).toBe('player')
    expect((await api('GET', '/api/auth/me')).body.user.mode).toBe('player')
    expect((await api('PATCH', '/api/auth/me', { body: { mode: 'spectator' } })).status).toBe(400)
  })

  it('renews the year-long session on every visit', async () => {
    const app = testApp()
    const { api } = await signedUp(app)
    const res = await api('GET', '/api/auth/me')
    expect(res.cookies[0]).toMatchObject({ name: SESSION_COOKIE, maxAge: 365 * 24 * 60 * 60 })
    expect((await app.call('GET', '/api/auth/me')).cookies).toEqual([])
  })
})

describe('campaign invites', () => {
  it('lets a player preview the link, claim a character and find the campaign on their side', async () => {
    const app = testApp()
    const c = await campaign(app)
    const token = await invite(c.dm.api, c.base, 'player')

    const preview = await app.call('GET', `/api/invites/${token}`)
    expect(preview.body).toMatchObject({ kind: 'campaign', name: 'Curse of the Hollow Crown', role: 'player', dm_name: 'Morgan', current: null })
    // Only visible PCs nobody plays: no monsters, no hidden twin.
    expect(preview.body.characters.map((x: { name: string }) => x.name)).toEqual(['Vex', 'Aldric'])

    const sam = await join(app, token, 'sam@example.com', 'Sam', { claim: c.vex })
    const home = (await sam.api('GET', '/api/player')).body
    expect(home.campaigns).toEqual([expect.objectContaining({ id: c.id, dm_name: 'Morgan', character: expect.objectContaining({ name: 'Vex' }) })])

    const view = (await sam.api('GET', `${c.base}/campaign`)).body
    expect(view.party.map((x: { name: string }) => x.name)).toEqual(['Vex', 'Aldric'])
    expect(view.party[0]).toMatchObject({ player_name: 'Sam' })
    expect(view.mine).toMatchObject({ id: c.vex, name: 'Vex', notes: null })
    expect(view.available.map((x: { name: string }) => x.name)).toEqual(['Aldric'])
    expect(JSON.stringify(view)).not.toContain('Hobgoblin')
  })

  it('keeps the DM screens to DMs', async () => {
    const app = testApp()
    const c = await campaign(app)
    const sam = await join(app, await invite(c.dm.api, c.base, 'player'), 'sam@example.com', 'Sam')
    expect((await sam.api('GET', c.base)).status).toBe(403)
    expect((await sam.api('PATCH', c.base, { body: { name: 'Mine' } })).status).toBe(403)
    expect((await sam.api('GET', '/api/presets')).body).toEqual([])
    // Strangers can't even tell it exists.
    const stranger = await signedUp(app, 'who@example.com', 'Who')
    expect((await stranger.api('GET', `${c.base}/campaign`)).status).toBe(404)
  })

  it('stops a link working once it’s reset or switched off', async () => {
    const app = testApp()
    const c = await campaign(app)
    const old = await invite(c.dm.api, c.base, 'player')
    const fresh = await invite(c.dm.api, c.base, 'player')
    expect(fresh).not.toBe(old)
    expect((await app.call('GET', `/api/invites/${old}`)).status).toBe(404)
    expect((await c.dm.api('DELETE', `${c.base}/invites/player`)).body).toEqual({ player: null, dm: null })
    expect((await app.call('GET', `/api/invites/${fresh}`)).status).toBe(404)
  })

  it('lets a player make a new character on joining, switch to a free one, and leave', async () => {
    const app = testApp()
    const c = await campaign(app)
    const token = await invite(c.dm.api, c.base, 'player')
    const sam = await join(app, token, 'sam@example.com', 'Sam', { create: { name: 'Pip', max_hp: 9, hidden: true, is_player: false } })

    let view = (await sam.api('GET', `${c.base}/campaign`)).body
    expect(view.mine).toMatchObject({ name: 'Pip', is_player: true, hidden: false })

    view = (await sam.api('POST', `${c.base}/character`, { body: { claim: c.aldric } })).body
    expect(view.mine.name).toBe('Aldric')
    expect(view.available.map((x: { name: string }) => x.name)).toEqual(['Vex', 'Pip'])

    const kit = await join(app, token, 'kit@example.com', 'Kit')
    expect((await kit.api('POST', `${c.base}/character`, { body: { claim: c.aldric } })).status).toBe(409)
    expect((await kit.api('POST', `${c.base}/character`, { body: { claim: c.twin } })).status).toBe(404)
    expect((await kit.api('POST', `${c.base}/character`, { body: { claim: c.hobgoblin } })).status).toBe(404)

    expect((await sam.api('DELETE', `${c.base}/members/${(await sam.api('GET', '/api/auth/me')).body.user.id}`)).status).toBe(204)
    expect((await sam.api('GET', '/api/player')).body.campaigns).toEqual([])
    const roster = (await c.dm.api('GET', c.base)).body
    expect(roster.creatures.find((x: { id: string }) => x.id === c.aldric).player_id).toBeNull()
  })
})

describe('characters', () => {
  it('lets a player edit their own sheet, nothing else, and carries it into the campaign’s fights', async () => {
    const app = testApp()
    const c = await campaign(app)
    const sam = await join(app, await invite(c.dm.api, c.base, 'player'), 'sam@example.com', 'Sam', { claim: c.vex })
    const encounterId = (await c.dm.api('POST', `${c.base}/launch`)).body.id as string

    const sheet = { ...fromDndBeyond(druid as DdbCharacter).sheet, player_notes: 'Afraid of owls' }
    const res = await sam.api('PATCH', `${c.base}/creatures/${c.vex}`, { body: { max_hp: 40, armor_class: 16, sheet } })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ max_hp: 40, notes: null, sheet: { player_notes: 'Afraid of owls' } })

    expect((await sam.api('PATCH', `${c.base}/creatures/${c.vex}`, { body: { notes: 'hi' } })).status).toBe(403)
    expect((await sam.api('PATCH', `${c.base}/creatures/${c.vex}`, { body: { hidden: true } })).status).toBe(403)
    expect((await sam.api('PATCH', `${c.base}/creatures/${c.aldric}`, { body: { max_hp: 99 } })).status).toBe(403)

    const fight = (await c.dm.api('GET', `/api/encounters/${encounterId}`)).body
    const copy = fight.creatures.find((x: { name: string }) => x.name === 'Vex')
    expect(copy).toMatchObject({ character_id: c.vex, max_hp: 40, armor_class: 16, current_hp: 33, sheet: { player_notes: 'Afraid of owls' } })
  })
})

describe('campaign encounters', () => {
  it('appear for the campaign’s players without a separate invite, unless hidden', async () => {
    const app = testApp()
    const c = await campaign(app)
    const sam = await join(app, await invite(c.dm.api, c.base, 'player'), 'sam@example.com', 'Sam', { claim: c.vex })
    const id = (await c.dm.api('POST', `${c.base}/launch`)).body.id as string

    let home = (await sam.api('GET', '/api/player')).body
    expect(home.encounters).toEqual([expect.objectContaining({ id, campaign_name: 'Curse of the Hollow Crown', character_name: 'Vex' })])
    expect((await sam.api('GET', `/api/encounters/${id}/view`)).status).toBe(200)
    expect((await sam.api('GET', `/api/encounters/${id}`)).status).toBe(403)

    await c.dm.api('PATCH', `/api/encounters/${id}`, { body: { hidden: true } })
    home = (await sam.api('GET', '/api/player')).body
    expect(home.encounters).toEqual([])
    expect((await sam.api('GET', `/api/encounters/${id}/view`)).status).toBe(404)

    // Hiding the campaign closes it and everything launched from it.
    await c.dm.api('PATCH', `/api/encounters/${id}`, { body: { hidden: false } })
    await c.dm.api('PATCH', c.base, { body: { hidden: true } })
    home = (await sam.api('GET', '/api/player')).body
    expect(home).toEqual({ campaigns: [], encounters: [] })
    expect((await sam.api('GET', `/api/encounters/${id}/view`)).status).toBe(404)
  })

  it('lets a player change their own HP and conditions mid-fight, and nothing else', async () => {
    const app = testApp()
    const c = await campaign(app)
    const sam = await join(app, await invite(c.dm.api, c.base, 'player'), 'sam@example.com', 'Sam', { claim: c.vex })
    const id = (await c.dm.api('POST', `${c.base}/launch`)).body.id as string
    const view = (await sam.api('GET', `/api/encounters/${id}/view`)).body
    const [mine] = view.mine as string[]
    const theirs = view.creatures.find((x: { name: string }) => x.name === 'Aldric').id
    const base = `/api/encounters/${id}/creatures`

    app.pings.length = 0
    const hit = await sam.api('PATCH', `${base}/${mine}`, { body: { current_hp: 20, conditions: [{ key: 'prone', rounds: null }] } })
    expect(hit.body).toMatchObject({ current_hp: 20, notes: null })
    expect(app.pings).toHaveLength(1)

    expect((await sam.api('PATCH', `${base}/${mine}`, { body: { initiative: 30 } })).status).toBe(403)
    expect((await sam.api('PATCH', `${base}/${theirs}`, { body: { current_hp: 1 } })).status).toBe(403)
    expect((await sam.api('POST', `/api/encounters/${id}/turn`, { body: { step: 1 } })).status).toBe(403)
  })

  it('hides hidden creatures from the player view, even on their turn', async () => {
    const app = testApp()
    const c = await campaign(app)
    const sam = await join(app, await invite(c.dm.api, c.base, 'player'), 'sam@example.com', 'Sam', { claim: c.vex })
    const id = (await c.dm.api('POST', `/api/presets/${c.id}/launch`)).body.id as string
    const fight = (await c.dm.api('GET', `/api/encounters/${id}`)).body
    const ogre = (await c.dm.api('POST', `/api/encounters/${id}/creatures`, { body: { creatures: [{ name: 'Ogre', initiative: 99, hidden: true }] } })).body[0]
    expect(fight.creatures.find((x: { name: string }) => x.name === 'Secret Twin').hidden).toBe(true)

    // The hidden Ogre opens the fight: for the players, combat hasn't started yet.
    await c.dm.api('POST', `/api/encounters/${id}/turn`, { body: { step: 1 } })
    const view = (await sam.api('GET', `/api/encounters/${id}/view`)).body
    expect(view.creatures.map((x: { name: string }) => x.name)).not.toContain('Ogre')
    expect(view.creatures.map((x: { name: string }) => x.name)).not.toContain('Secret Twin')
    expect(view).toMatchObject({ active_creature_id: null, round: 1 })
    expect(view).not.toHaveProperty('hidden_turn')

    await c.dm.api('PATCH', `/api/encounters/${id}/creatures/${ogre.id}`, { body: { hidden: false } })
    expect((await sam.api('GET', `/api/encounters/${id}/view`)).body).toMatchObject({ active_creature_id: ogre.id })
  })
})

describe('co-DMs', () => {
  it('run the campaign and its fights alongside the owner, but can’t delete them', async () => {
    const app = testApp()
    const c = await campaign(app)
    const ash = await join(app, await invite(c.dm.api, c.base, 'dm'), 'ash@example.com', 'Ash')

    expect((await ash.api('GET', '/api/presets')).body).toEqual([expect.objectContaining({ id: c.id, members: 1 })])
    expect((await ash.api('PATCH', c.base, { body: { name: 'Renamed' } })).status).toBe(200)

    const id = (await ash.api('POST', `${c.base}/launch`)).body.id as string
    const fight = (await c.dm.api('GET', `/api/encounters/${id}`)).body
    expect(fight).toMatchObject({ owner_id: c.dm.user.id, campaign_id: c.id, title: 'Renamed' })
    expect((await ash.api('GET', '/api/encounters')).body.map((e: { id: string }) => e.id)).toEqual([id])
    expect((await ash.api('POST', `/api/encounters/${id}/turn`, { body: { step: 1 } })).status).toBe(200)

    expect((await ash.api('DELETE', `/api/encounters/${id}`)).status).toBe(403)
    expect((await ash.api('DELETE', c.base)).status).toBe(403)
    expect((await c.dm.api('DELETE', c.base)).status).toBe(204)
  })

  it('can be invited to a single encounter too, alongside players', async () => {
    const app = testApp()
    const dm = await signedUp(app, 'dm@example.com', 'Morgan')
    const id = (await dm.api('POST', '/api/encounters', { body: { title: 'One-shot' } })).body.id as string
    const base = `/api/encounters/${id}`
    await dm.api('POST', `${base}/creatures`, { body: { creatures: [{ name: 'Rook', is_player: true, initiative: 10 }] } })

    const ash = await join(app, await invite(dm.api, base, 'dm'), 'ash@example.com', 'Ash')
    expect((await ash.api('GET', base)).status).toBe(200)

    const sam = await join(app, await invite(dm.api, base, 'player'), 'sam@example.com', 'Sam', { create: { name: 'Juniper', initiative: 14 } })
    const view = (await sam.api('GET', `${base}/view`)).body
    expect(view.mine).toHaveLength(1)
    expect(view.creatures.map((x: { name: string }) => x.name)).toEqual(['Juniper', 'Rook'])
    expect((await sam.api('GET', '/api/player')).body.encounters).toEqual([expect.objectContaining({ id, character_name: 'Juniper' })])

    // A player promoted to co-DM; the invite never demotes.
    await dm.api('PATCH', `${base}/members/${(await sam.api('GET', '/api/auth/me')).body.user.id}`, { body: { role: 'dm' } })
    expect((await sam.api('GET', base)).status).toBe(200)
  })
})

describe('older documents', () => {
  it('still open after the fields for campaigns were added', async () => {
    const store = memoryStore()
    const app = testApp({ store })
    const { api, user } = await signedUp(app)
    const at = new Date().toISOString()
    await store.createTable({
      kind: 'preset',
      id: 'old-preset',
      owner_id: user.id,
      name: 'Before campaigns',
      description: null,
      background_url: null,
      created_at: at,
      updated_at: at,
      creatures: [{ id: 'c1', owner_id: user.id, encounter_id: null, preset_id: 'old-preset', name: 'Vex', is_player: true, initiative: 10, initiative_bonus: 0, max_hp: 10, current_hp: 10, temp_hp: 0, armor_class: null, conditions: [], notes: null, image_url: null, created_at: at }],
    } as never)

    expect((await api('GET', '/api/presets')).body[0]).toMatchObject({ id: 'old-preset', hidden: false, members: 0 })
    expect((await api('GET', '/api/presets/old-preset')).body).toMatchObject({ members: [], invites: { player: null, dm: null } })
    const token = await invite(api, '/api/presets/old-preset', 'player')
    await join(app, token, 'sam@example.com', 'Sam', { claim: 'c1' })
    expect((await api('POST', '/api/presets/old-preset/launch')).status).toBe(201)
  })
})

describe('D&D Beyond import', () => {
  it('finds the character id in the links people paste', () => {
    expect(characterIdFromUrl('https://www.dndbeyond.com/characters/164667811')).toBe('164667811')
    expect(characterIdFromUrl('https://www.dndbeyond.com/profile/someone/characters/164667811')).toBe('164667811')
    expect(characterIdFromUrl('https://dndbeyond.com/characters/164667811/builder')).toBe('164667811')
    expect(characterIdFromUrl(' https://ddb.ac/characters/164667811/Xyz ')).toBe('164667811')
    expect(characterIdFromUrl('https://evil.example/characters/164667811')).toBeNull()
    expect(characterIdFromUrl('not a link')).toBeNull()
  })

  it('works out scores, HP, AC, speed, proficiencies and spell slots like the sheet does', () => {
    const c = fromDndBeyond(druid as DdbCharacter)
    expect(c).toMatchObject({ name: 'Alekson', is_player: true, max_hp: 63, armor_class: 13, initiative_bonus: 0 })
    expect(c.image_url).toMatch(/^https:\/\/www\.dndbeyond\.com\/avatars\//)
    expect(c.sheet).toMatchObject({
      classes: [{ name: 'Druid', subclass: 'Circle of the Land', level: 10 }],
      abilities: { str: 8, dex: 10, con: 12, int: 16, wis: 18, cha: 13 },
      speed: 35,
      saves: ['int', 'wis'],
      spellcasting_ability: 'wis',
      background: 'Haunted One',
      source_url: 'https://www.dndbeyond.com/characters/164667811',
    })
    expect(c.sheet!.spell_slots.map((s) => s.max)).toEqual([4, 3, 3, 3, 2])
    expect(Object.keys(c.sheet!.skills).sort()).toEqual(['animal-handling', 'investigation', 'medicine', 'nature', 'perception', 'survival'])
    expect(c.sheet!.inventory).toContainEqual({ name: 'Torch', quantity: 3, equipped: false })
  })

  it('returns a draft for public characters and explains private ones', async () => {
    const app = testApp({ web: { [characterJsonUrl('164667811')]: { success: true, data: druid } } })
    const { api } = await signedUp(app)
    const ok = await api('POST', '/api/import/dndbeyond', { body: { url: 'https://www.dndbeyond.com/characters/164667811' } })
    expect(ok.body).toMatchObject({ name: 'Alekson', max_hp: 63, sheet: { abilities: { wis: 18 } } })

    const hidden = await api('POST', '/api/import/dndbeyond', { body: { url: 'https://www.dndbeyond.com/characters/1' } })
    expect(hidden).toMatchObject({ status: 404, body: { error: expect.stringContaining('Character Privacy') } })
    expect((await api('POST', '/api/import/dndbeyond', { body: { url: 'https://example.com' } })).status).toBe(400)
    expect((await app.call('POST', '/api/import/dndbeyond', { body: { url: 'x' } })).status).toBe(401)
  })
})

describe('folders and live encounters', () => {
  it('files a loose encounter into a campaign folder, so its players see it without their character in it', async () => {
    const app = testApp()
    const c = await campaign(app)
    const sam = await join(app, await invite(c.dm.api, c.base, 'player'), 'sam@example.com', 'Sam', { claim: c.vex })
    const loose = (await c.dm.api('POST', '/api/encounters', { body: { title: 'Bandits at the ford' } })).body.id as string
    expect((await sam.api('GET', `/api/encounters/${loose}/view`)).status).toBe(404)

    expect((await c.dm.api('PATCH', `/api/encounters/${loose}`, { body: { campaign_id: c.id } })).body.campaign_id).toBe(c.id)
    const view = await sam.api('GET', `/api/encounters/${loose}/view`)
    expect(view.status).toBe(200)
    expect(view.body).toMatchObject({ mine: [], characters: [] })
    const home = (await sam.api('GET', '/api/player')).body
    expect(home.encounters).toEqual([expect.objectContaining({ id: loose, campaign_id: c.id, campaign_name: 'Curse of the Hollow Crown' })])

    // Out of the folder again: closed to the campaign.
    await c.dm.api('PATCH', `/api/encounters/${loose}`, { body: { campaign_id: null } })
    expect((await sam.api('GET', `/api/encounters/${loose}/view`)).status).toBe(404)
  })

  it('won’t file into a folder the caller doesn’t run', async () => {
    const app = testApp()
    const c = await campaign(app)
    const other = await signedUp(app, 'other@example.com', 'Other')
    const theirs = (await other.api('POST', '/api/encounters', { body: { title: 'Mine' } })).body.id as string
    expect((await other.api('PATCH', `/api/encounters/${theirs}`, { body: { campaign_id: c.id } })).status).toBe(404)
  })

  it('sends a player their own character in full, without the DM’s notes', async () => {
    const app = testApp()
    const c = await campaign(app)
    const sam = await join(app, await invite(c.dm.api, c.base, 'player'), 'sam@example.com', 'Sam', { claim: c.vex })
    const id = (await c.dm.api('POST', `${c.base}/launch`)).body.id as string
    const view = (await sam.api('GET', `/api/encounters/${id}/view`)).body
    expect(view.characters).toHaveLength(1)
    expect(view.characters[0]).toMatchObject({ name: 'Vex', character_id: c.vex, notes: null, armor_class: 15 })
    expect(view.mine).toEqual([view.characters[0].id])
  })

  it('is live while a DM has it open, and not while it’s hidden', async () => {
    const app = testApp()
    const c = await campaign(app)
    const sam = await join(app, await invite(c.dm.api, c.base, 'player'), 'sam@example.com', 'Sam', { claim: c.vex })
    const id = (await c.dm.api('POST', `${c.base}/launch`)).body.id as string
    const live = async () => [
      (await c.dm.api('GET', '/api/encounters')).body[0].live,
      (await sam.api('GET', '/api/player')).body.encounters[0]?.live,
    ]
    expect(await live()).toEqual([false, false])

    expect((await c.dm.api('POST', `/api/encounters/${id}/presence`)).status).toBe(204)
    expect(await live()).toEqual([true, true])
    expect((await sam.api('POST', `/api/encounters/${id}/presence`)).status).toBe(403)

    await c.dm.api('PATCH', `/api/encounters/${id}`, { body: { hidden: true } })
    expect((await c.dm.api('GET', '/api/encounters')).body[0].live).toBe(false)
    await c.dm.api('PATCH', `/api/encounters/${id}`, { body: { hidden: false } })

    await c.dm.api('DELETE', `/api/encounters/${id}/presence`)
    expect(await live()).toEqual([false, false])
  })
})

describe('personal folders', () => {
  it('keeps each person’s folders to themselves and drops filings for missing folders', async () => {
    const app = testApp()
    const { api: dm } = await signedUp(app, 'dm@example.com', 'Morgan')
    const { api: other } = await signedUp(app, 'other@example.com', 'Other')
    expect((await dm('GET', '/api/folders')).body).toEqual({ folders: [], filed: {} })

    const saved = await dm('PUT', '/api/folders', {
      body: { folders: [{ id: 'f1', name: 'Session 12', side: 'dm' }], filed: { enc1: 'f1', enc2: 'gone' } },
    })
    expect(saved.body).toEqual({ folders: [{ id: 'f1', name: 'Session 12', side: 'dm' }], filed: { enc1: 'f1' } })
    expect((await dm('GET', '/api/folders')).body.folders).toHaveLength(1)
    expect((await other('GET', '/api/folders')).body.folders).toEqual([])

    expect((await dm('PUT', '/api/folders', { body: { folders: [{ id: 'x', name: '', side: 'dm' }] } })).status).toBe(400)
    expect((await dm('PUT', '/api/folders', { body: { folders: [{ id: 'x', name: 'Ok', side: 'gm' }] } })).status).toBe(400)
  })
})
