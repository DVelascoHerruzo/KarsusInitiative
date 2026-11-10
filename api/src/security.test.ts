import { signedUp, testApp, verifyToken } from './test/harness'

const PASSWORD = 'correct horse battery'

describe('rate limits', () => {
  it('stops a flood of sign-in attempts from one address, whatever the email', async () => {
    const app = testApp()
    const from = { 'x-azure-clientip': '203.0.113.7' }
    let last = 0
    for (let i = 0; i < 31; i++) {
      last = (await app.call('POST', '/api/auth/signin', { body: { email: `who${i}@example.com`, password: 'nope nope nope' }, headers: from })).status
    }
    expect(last).toBe(429)
    // Someone else is unaffected.
    const other = await app.call('POST', '/api/auth/signin', { body: { email: 'a@example.com', password: 'x' }, headers: { 'x-azure-clientip': '198.51.100.1' } })
    expect(other.status).toBe(401)
  })

  it('sends at most three reset emails an hour to one address', async () => {
    const app = testApp()
    await signedUp(app)
    const statuses = []
    for (let i = 0; i < 4; i++) {
      statuses.push((await app.call('POST', '/api/auth/forgot', { body: { email: 'dm@example.com' }, headers: { 'x-azure-clientip': `10.0.0.${i}` } })).status)
    }
    expect(statuses).toEqual([204, 204, 204, 429])
    expect(app.mail.filter((m) => m.subject.includes('Reset'))).toHaveLength(3)
  })

  it('never stores the raw address or email it counts', async () => {
    const app = testApp()
    await app.call('POST', '/api/auth/forgot', { body: { email: 'secret@example.com' }, headers: { 'x-azure-clientip': '203.0.113.9' } })
    const ids = JSON.stringify(app.dump())
    expect(ids).not.toMatch(/203\.0\.113\.9|secret@example\.com/)
  })
})

describe('breached passwords', () => {
  it('refuses a password that has leaked, asking Have I Been Pwned with only a hash prefix', async () => {
    // SHA-1 of "password" is 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8.
    const app = testApp({ web: { 'https://api.pwnedpasswords.com/range/5BAA6': '1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\n0000000000000000000000000000000000:0' } })
    const res = await app.call('POST', '/api/auth/signup', { body: { email: 'a@b.co', username: 'A', password: 'password' } })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/data breach/)
    // Only the first five hex characters of the hash ever leave the server.
    expect(app.requested).toEqual(['https://api.pwnedpasswords.com/range/5BAA6'])
  })

  it('lets sign-up through when the breach service can’t be reached', async () => {
    const app = testApp()
    expect((await app.call('POST', '/api/auth/signup', { body: { email: 'a@b.co', username: 'A', password: PASSWORD } })).status).toBe(201)
  })
})

describe('your account', () => {
  it('changes the password after checking the old one, and signs out other devices', async () => {
    const app = testApp()
    const { api: laptop } = await signedUp(app)
    const phone = app.client()
    await phone('POST', '/api/auth/signin', { body: { email: 'dm@example.com', password: PASSWORD } })

    expect((await laptop('POST', '/api/auth/password', { body: { current: 'wrong', password: 'a brand new password' } })).status).toBe(403)
    expect((await laptop('POST', '/api/auth/password', { body: { current: PASSWORD, password: 'a brand new password' } })).status).toBe(200)
    expect((await laptop('GET', '/api/auth/me')).body.user).not.toBeNull()
    expect((await phone('GET', '/api/auth/me')).body.user).toBeNull()
  })

  it('signs out every other device on request', async () => {
    const app = testApp()
    const { api: laptop } = await signedUp(app)
    const phone = app.client()
    await phone('POST', '/api/auth/signin', { body: { email: 'dm@example.com', password: PASSWORD } })
    expect((await laptop('POST', '/api/auth/signout-others')).status).toBe(204)
    expect((await laptop('GET', '/api/auth/me')).body.user).not.toBeNull()
    expect((await phone('GET', '/api/auth/me')).body.user).toBeNull()
  })

  it('exports what it stores about you, without the password hash', async () => {
    const app = testApp()
    const { api } = await signedUp(app)
    await api('POST', '/api/encounters', { body: { title: 'Ambush' } })
    const res = await api('GET', '/api/auth/export')
    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toMatch(/attachment/)
    expect(res.body.account).toMatchObject({ email: 'dm@example.com', username: 'Dungeon Master' })
    expect(res.body.your_encounters).toHaveLength(1)
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|password_hash/)
  })

  it('deletes the account and everything it owns, after confirming the password', async () => {
    const app = testApp()
    const { api, user } = await signedUp(app)
    const id = (await api('POST', '/api/encounters', { body: { title: 'Ambush' } })).body.id as string
    const preset = (await api('POST', '/api/presets', { body: { name: 'Campaign' } })).body.id as string
    const player = await signedUp(app, 'p@example.com', 'Sam')
    const token = (await api('POST', `/api/presets/${preset}/invites/player`)).body.player as string
    await player.api('POST', `/api/invites/${token}`, { body: {} })
    // Sam is also the DM of a campaign Morgan plays in: deleting Morgan frees her seat there.
    const samCampaign = (await player.api('POST', '/api/presets', { body: { name: 'Sam’s game' } })).body.id as string
    const samInvite = (await player.api('POST', `/api/presets/${samCampaign}/invites/player`)).body.player as string
    await api('POST', `/api/invites/${samInvite}`, { body: {} })

    expect((await api('DELETE', '/api/auth/account', { body: { password: 'wrong password' } })).status).toBe(403)
    expect((await api('DELETE', '/api/auth/account', { body: { password: PASSWORD } })).status).toBe(204)

    expect((await api('GET', '/api/auth/me')).body.user).toBeNull()
    expect(app.removedImages).toEqual([`${user.id}/`])
    expect((await app.call('POST', '/api/auth/signin', { body: { email: 'dm@example.com', password: PASSWORD } })).status).toBe(401)
    expect((await player.api('GET', `/api/encounters/${id}/view`)).status).toBe(404)
    expect((await player.api('GET', '/api/player')).body.campaigns).toEqual([])
    expect((await player.api('GET', `/api/presets/${samCampaign}`)).body.members).toEqual([])
    // The email can be used again.
    expect((await app.call('POST', '/api/auth/signup', { body: { email: 'dm@example.com', username: 'New', password: PASSWORD } })).status).toBe(201)
  })
})

describe('caching', () => {
  it('answers an unchanged read with an empty 304, and keeps account answers out of every cache', async () => {
    const app = testApp()
    const { api } = await signedUp(app)
    const id = (await api('POST', '/api/encounters', { body: { title: 'Ambush' } })).body.id as string
    const first = await api('GET', `/api/encounters/${id}`)
    expect(first.headers).toMatchObject({ 'cache-control': 'private, no-cache' })
    const again = await api('GET', `/api/encounters/${id}`, { headers: { 'if-none-match': first.headers.etag! } })
    expect(again.status).toBe(304)
    expect(again.body).toBeUndefined()

    await api('PATCH', `/api/encounters/${id}`, { body: { title: 'Ambush at dusk' } })
    expect((await api('GET', `/api/encounters/${id}`, { headers: { 'if-none-match': first.headers.etag! } })).status).toBe(200)
    expect((await api('GET', '/api/auth/me')).headers['cache-control']).toBe('no-store')
  })
})

describe('email verification', () => {
  it('emails a link on sign-up, and keeps the account to its own settings until it’s opened', async () => {
    const app = testApp()
    const { api, user } = await signedUp(app, 'new@example.com', 'Newcomer', { verify: false })
    expect(user.email_verified).toBe(false)
    const mail = app.mail.find((m) => m.to === 'new@example.com')!
    expect(mail.subject).toMatch(/Confirm your email/)
    expect(mail.text).toContain(`${'https://karsus.test'}/verify-email?token=`)

    const blocked = await api('POST', '/api/encounters', { body: { title: 'Too soon' } })
    expect(blocked).toMatchObject({ status: 403, body: { error: expect.stringMatching(/Confirm your email/) } })
    // Their own account still works: settings, export, deletion.
    expect((await api('PATCH', '/api/auth/me', { body: { mode: 'player' } })).status).toBe(200)
    expect((await api('GET', '/api/auth/export')).status).toBe(200)

    const verified = await api('POST', '/api/auth/verify', { body: { token: verifyToken(app, 'new@example.com') } })
    expect(verified.body.user.email_verified).toBe(true)
    expect((await api('POST', '/api/encounters', { body: { title: 'Now' } })).status).toBe(201)
  })

  it('works once, from any device, and signs that device in', async () => {
    const app = testApp()
    await signedUp(app, 'new@example.com', 'Newcomer', { verify: false })
    const token = verifyToken(app, 'new@example.com')
    const phone = app.client()
    expect((await phone('POST', '/api/auth/verify', { body: { token } })).status).toBe(200)
    expect((await phone('GET', '/api/auth/me')).body.user.email).toBe('new@example.com')
    expect((await phone('POST', '/api/auth/verify', { body: { token } })).status).toBe(400)
    expect((await phone('POST', '/api/auth/verify', { body: { token: 'made-up' } })).status).toBe(400)
  })

  it('sends a fresh link on request, a few times an hour at most', async () => {
    const app = testApp()
    const { api } = await signedUp(app, 'new@example.com', 'Newcomer', { verify: false })
    const statuses = []
    for (let i = 0; i < 5; i++) statuses.push((await api('POST', '/api/auth/verify/resend')).status)
    expect(statuses).toEqual([204, 204, 204, 204, 429])
    expect(app.mail.filter((m) => m.to === 'new@example.com')).toHaveLength(5)
  })

  it('isn’t required where the server can’t send email', async () => {
    const app = testApp()
    app.s.mail = null
    const res = await app.call('POST', '/api/auth/signup', { body: { email: 'a@b.co', username: 'A', password: PASSWORD } })
    const cookie = `karsus_session=${res.cookies[0]!.value}`
    expect((await app.call('POST', '/api/encounters', { body: { title: 'Fine' }, cookie, origin: 'https://karsus.test' })).status).toBe(201)
  })

  it('replies to Karsus emails go to the support inbox, and every email names it', async () => {
    const app = testApp()
    await signedUp(app, 'new@example.com', 'Newcomer', { verify: false })
    expect(app.mail[0]!.text).toContain('karsus.support@gmail.com')
  })
})
