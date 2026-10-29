import { assertSameOrigin, type ApiRequest } from './http'
import { googleUser } from './routes/auth'
import { entryId } from './store/types'
import { ORIGIN, signedUp, testApp } from './test/harness'

const PASSWORD = 'correct horse battery'

describe('accounts', () => {
  it('signs up, knows who you are, and signs out', async () => {
    const app = testApp()
    const { api, user } = await signedUp(app)
    expect(user).toMatchObject({ email: 'dm@example.com', username: 'Dungeon Master' })

    expect((await api('GET', '/api/auth/me')).body).toEqual({ user, google: false })
    expect((await api('POST', '/api/auth/signout')).status).toBe(204)
    expect((await api('GET', '/api/auth/me')).body).toMatchObject({ user: null })
  })

  it('sets the session as an HttpOnly, SameSite=Lax, secure cookie', async () => {
    const app = testApp()
    const res = await app.call('POST', '/api/auth/signup', { body: { email: 'a@b.co', username: 'A', password: PASSWORD } })
    expect(res.cookies[0]).toMatchObject({ name: 'karsus_session', httpOnly: true, sameSite: 'Lax', secure: true, path: '/' })
  })

  it('refuses a second account on the same email, in any letter case', async () => {
    const app = testApp()
    await signedUp(app, 'dm@example.com')
    const res = await app.call('POST', '/api/auth/signup', { body: { email: 'DM@Example.com', username: 'Again', password: PASSWORD } })
    expect(res.status).toBe(409)
  })

  it('validates sign-up fields with readable messages', async () => {
    const app = testApp()
    const res = await app.call('POST', '/api/auth/signup', { body: { email: 'not-an-email', username: 'x', password: PASSWORD } })
    expect(res).toMatchObject({ status: 400, body: { error: 'That doesn’t look like an email address' } })
    const short = await app.call('POST', '/api/auth/signup', { body: { email: 'a@b.co', username: 'x', password: 'short' } })
    expect(short.body.error).toMatch(/at least 8 characters/)
  })

  it('signs in with the right password and gives the same answer for a wrong password or unknown email', async () => {
    const app = testApp()
    await signedUp(app)
    const ok = await app.call('POST', '/api/auth/signin', { body: { email: 'dm@example.com', password: PASSWORD } })
    expect(ok.status).toBe(200)
    const wrong = await app.call('POST', '/api/auth/signin', { body: { email: 'dm@example.com', password: 'nope nope nope' } })
    const unknown = await app.call('POST', '/api/auth/signin', { body: { email: 'who@example.com', password: PASSWORD } })
    expect(wrong).toMatchObject({ status: 401, body: { error: 'Wrong email or password' } })
    expect(unknown).toMatchObject({ status: 401, body: { error: 'Wrong email or password' } })
  })

  it('locks an account for 15 minutes after 10 wrong passwords', async () => {
    const app = testApp()
    await signedUp(app)
    for (let i = 0; i < 10; i++) await app.call('POST', '/api/auth/signin', { body: { email: 'dm@example.com', password: 'wrong password' } })
    const locked = await app.call('POST', '/api/auth/signin', { body: { email: 'dm@example.com', password: PASSWORD } })
    expect(locked.status).toBe(429)
  })

  it('resets a password by emailed link once, and signs out other devices', async () => {
    const app = testApp()
    const { api: laptop } = await signedUp(app)

    expect((await app.call('POST', '/api/auth/forgot', { body: { email: 'dm@example.com' } })).status).toBe(204)
    expect(app.mail).toHaveLength(1)
    const link = /https:\S+/.exec(app.mail[0]!.text)![0]
    expect(link.startsWith(`${ORIGIN}/reset-password?token=`)).toBe(true)
    const token = new URL(link).searchParams.get('token')

    const phone = app.client()
    const reset = await phone('POST', '/api/auth/reset', { body: { token, password: 'a brand new password' } })
    expect(reset.status).toBe(200)
    expect((await phone('GET', '/api/auth/me')).body.user.email).toBe('dm@example.com')
    expect((await laptop('GET', '/api/auth/me')).body).toMatchObject({ user: null })

    const again = await phone('POST', '/api/auth/reset', { body: { token, password: 'another new password' } })
    expect(again.status).toBe(400)
    const signin = await app.call('POST', '/api/auth/signin', { body: { email: 'dm@example.com', password: 'a brand new password' } })
    expect(signin.status).toBe(200)
  })

  it('answers "forgot password" the same way for unknown emails, and sends nothing', async () => {
    const app = testApp()
    expect((await app.call('POST', '/api/auth/forgot', { body: { email: 'nobody@example.com' } })).status).toBe(204)
    expect(app.mail).toHaveLength(0)
  })

  it('refuses writes from another site and bodies that aren’t JSON', async () => {
    const app = testApp()
    const cross = await app.call('POST', '/api/auth/signup', { body: { email: 'a@b.co', username: 'A', password: PASSWORD }, origin: 'https://evil.example' })
    expect(cross.status).toBe(403)
    const form = await app.call('POST', '/api/auth/signup', { body: 'email=a@b.co', type: 'application/x-www-form-urlencoded' })
    expect(form.status).toBe(415)
  })
})

describe('same-origin check behind Static Web Apps', () => {
  // The function sees an internal URL; the public host only arrives in forwarding headers.
  const req = (origin: string, headers: Record<string, string>): ApiRequest => ({
    method: 'POST',
    url: 'http://127.0.0.1:7071/api/auth/signup',
    headers: new Headers({ origin, ...headers }),
    params: {},
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0),
  })
  const site = 'https://orange-desert.azurestaticapps.net'

  it('accepts the public host from Host, X-Forwarded-Host or X-MS-Original-URL', () => {
    expect(() => assertSameOrigin(req(site, { host: 'orange-desert.azurestaticapps.net' }), null, false)).not.toThrow()
    expect(() => assertSameOrigin(req(site, { 'x-forwarded-host': 'orange-desert.azurestaticapps.net' }), null, false)).not.toThrow()
    expect(() => assertSameOrigin(req(site, { 'x-ms-original-url': `${site}/api/auth/signup` }), null, false)).not.toThrow()
  })

  it('still refuses other sites', () => {
    expect(() => assertSameOrigin(req('https://evil.example', { host: 'orange-desert.azurestaticapps.net' }), 'https://karsusinitiative.com', false)).toThrow(
      'Cross-site requests aren’t allowed',
    )
  })
})

describe('Google sign-in', () => {
  const profile = { sub: 'g-123', email: 'dm@example.com', name: 'Morgan' }

  it('creates an account the first time and finds it after', async () => {
    const app = testApp()
    const first = await googleUser(app.s, profile)
    const second = await googleUser(app.s, profile)
    expect(second.user_id).toBe(first.user_id)
    expect(first).toMatchObject({ username: 'Morgan', email_verified: true, password_hash: null })
  })

  it('links to a password account whose email was already proven, keeping the password', async () => {
    const app = testApp()
    const { user } = await signedUp(app)
    const stored = (await app.s.store.getEntry(entryId.user(user.id), 'user'))!
    await app.s.store.putEntry({ ...stored, email_verified: true })

    const linked = await googleUser(app.s, profile)
    expect(linked.user_id).toBe(user.id)
    expect(linked.password_hash).not.toBeNull()
  })

  it('takes over an unproven account for the real owner: the old password and sessions stop working', async () => {
    const app = testApp()
    const { api: squatter, user } = await signedUp(app)

    const linked = await googleUser(app.s, profile)
    expect(linked.user_id).toBe(user.id)
    expect(linked.password_hash).toBeNull()
    expect((await squatter('GET', '/api/auth/me')).body).toMatchObject({ user: null })
    const signin = await app.call('POST', '/api/auth/signin', { body: { email: 'dm@example.com', password: PASSWORD } })
    expect(signin.status).toBe(401)
  })

  it('tells the sign-in page whether Google is available, and bounces back when it isn’t', async () => {
    const off = testApp()
    expect((await off.call('GET', '/api/auth/me')).body).toEqual({ user: null, google: false })
    const res = await off.call('GET', '/api/auth/google?next=/encounters/1')
    expect(res).toMatchObject({ status: 302, headers: { location: '/login?error=google' } })

    const on = testApp({ env: { GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'secret' } })
    expect((await on.call('GET', '/api/auth/me')).body).toEqual({ user: null, google: true })
  })

  it('sends the browser to Google with PKCE and a signed state cookie', async () => {
    const app = testApp({ env: { GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'secret' } })
    const res = await app.call('GET', '/api/auth/google?next=/encounters/1')
    expect(res.status).toBe(302)
    const url = new URL(res.headers.location!)
    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/google/callback`)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(res.cookies[0]).toMatchObject({ name: 'karsus_oauth', httpOnly: true })
  })

  it('bounces a callback without a matching state back to the login page', async () => {
    const app = testApp({ env: { GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'secret' } })
    const res = await app.call('GET', '/api/auth/google/callback?code=abc&state=forged')
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/login?error=google')
  })
})
