import { setPasswordCost } from '../auth/password'
import { readConfig } from '../config'
import { dispatch } from '../dispatch'
import type { ApiRequest, ApiResponse } from '../http'
import { routes } from '../routes'
import type { Images, Live, Mail, Services } from '../services'
import { memoryStore } from '../store/memory'
import type { Store } from '../store/types'

// Drives the real route table and dispatcher against an in-memory store, with
// fakes that record live pings, uploads and outgoing mail.

setPasswordCost({ N: 2 ** 10, r: 8, p: 1 })

export const ORIGIN = 'https://karsus.test'

export interface TestApp {
  s: Services
  pings: string[]
  mail: { to: string; subject: string; text: string }[]
  /** Image folders deleted, for account deletion. */
  removedImages: string[]
  /** Every URL the API fetched from the internet. */
  requested: string[]
  /** Everything in the store. */
  dump(): unknown[]
  call(method: string, path: string, opts?: CallOptions & { cookie?: string }): Promise<Res>
  /** A client that keeps cookies between calls, like a browser. */
  client(): Client
}

export interface Res {
  status: number
  // Response JSON is checked with expect(); tests index into it freely, and a wrong guess fails the assertion.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
  headers: Record<string, string>
  cookies: NonNullable<ApiResponse['cookies']>
}

export interface CallOptions {
  body?: unknown
  raw?: Uint8Array
  type?: string
  origin?: string
  headers?: Record<string, string>
}

export type Client = (method: string, path: string, opts?: CallOptions) => Promise<Res>

function match(path: string) {
  const [pathname] = path.split('?')
  for (const route of routes) {
    const names: string[] = []
    const pattern = route.route.replace(/\{(\w+)\}/g, (_, name: string) => {
      names.push(name)
      return '([^/]+)'
    })
    const m = new RegExp(`^/api/${pattern}$`).exec(pathname!)
    if (m) return { route, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1]!)])) }
  }
  throw new Error(`No route for ${path}`)
}

/** `web` maps outgoing URLs to the JSON they answer with; anything else is a 404. */
export function testApp(overrides: { store?: Store; env?: Record<string, string>; web?: Record<string, unknown> } = {}): TestApp {
  const requested: string[] = []
  const store = overrides.store ?? memoryStore()
  const pings: string[] = []
  const mail: TestApp['mail'] = []
  const live: Live = {
    async notify(token) {
      pings.push(token)
    },
    async clientUrl(token) {
      return `wss://live.test/${token}`
    },
  }
  const removedImages: string[] = []
  const images: Images = {
    async put(path) {
      return `https://images.test/${path}`
    },
    async removeAll(prefix) {
      removedImages.push(prefix)
    },
  }
  const mailer: Mail = {
    async send(m) {
      mail.push(m)
    },
  }
  const s: Services = {
    config: readConfig({ SESSION_SECRET: 'test-secret-that-is-at-least-32-characters', PUBLIC_ORIGIN: ORIGIN, ...overrides.env }),
    store,
    live,
    images,
    mail: mailer,
    fetch: async (input) => {
      requested.push(String(input))
      const body = overrides.web?.[String(input)]
      if (body === undefined) return new Response('{"success":false}', { status: 404 })
      return typeof body === 'string' ? new Response(body) : Response.json(body)
    },
    now: () => new Date(),
    log: { warn() {}, error() {} },
  }

  const call: TestApp['call'] = async (method, path, opts = {}) => {
    const { route, params } = match(path)
    const headers = new Headers()
    let raw: Uint8Array | undefined
    if (opts.raw) {
      raw = opts.raw
      headers.set('content-type', opts.type ?? 'image/webp')
    } else if (opts.body !== undefined) {
      raw = new TextEncoder().encode(JSON.stringify(opts.body))
      headers.set('content-type', opts.type ?? 'application/json')
    }
    if (opts.origin !== undefined) headers.set('origin', opts.origin)
    if (opts.cookie) headers.set('cookie', opts.cookie)
    for (const [name, value] of Object.entries(opts.headers ?? {})) headers.set(name, value)
    const req: ApiRequest = {
      method,
      url: `${ORIGIN}${path}`,
      headers,
      params,
      json: async () => JSON.parse(new TextDecoder().decode(raw)),
      arrayBuffer: async () => (raw ?? new Uint8Array()).slice().buffer,
    }
    const res = await dispatch(route, req, s)
    return { status: res.status ?? 200, body: res.jsonBody, headers: res.headers ?? {}, cookies: res.cookies ?? [] }
  }

  return {
    s,
    pings,
    mail,
    removedImages,
    requested,
    dump: () => ('dump' in store && typeof store.dump === 'function' ? (store.dump as () => unknown[])() : []),
    call,
    client() {
      const jar = new Map<string, string>()
      return async (method, path, opts = {}) => {
        const cookie = [...jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
        const res = await call(method, path, { origin: ORIGIN, ...opts, cookie })
        for (const c of res.cookies) {
          if (c.maxAge === 0 || !c.value) jar.delete(c.name)
          else jar.set(c.name, c.value)
        }
        return res
      }
    },
  }
}

/** A signed-up client, ready to use. */
/** A signed-up client whose email is confirmed, ready to use. Pass `verify: false` to stop before opening the email. */
export async function signedUp(app: TestApp, email = 'dm@example.com', username = 'Dungeon Master', opts: { verify?: boolean } = {}) {
  const api = app.client()
  const res = await api('POST', '/api/auth/signup', { body: { email, username, password: 'correct horse battery' } })
  if (res.status !== 201) throw new Error(`signup failed: ${JSON.stringify(res.body)}`)
  let user = res.body.user as { id: string; email: string; username: string; mode: string; email_verified: boolean }
  if (opts.verify !== false) {
    const verified = await api('POST', '/api/auth/verify', { body: { token: verifyToken(app, email) } })
    if (verified.status !== 200) throw new Error(`verify failed: ${JSON.stringify(verified.body)}`)
    user = verified.body.user
  }
  return { api, user }
}

/** The token from the latest verification email sent to an address. */
export function verifyToken(app: TestApp, email: string): string {
  const mail = app.mail.filter((m) => m.to === email && m.text.includes('/verify-email?token=')).at(-1)
  if (!mail) throw new Error(`no verification email for ${email}`)
  return new URL(/https:\S+/.exec(mail.text)![0]).searchParams.get('token')!
}

/** A minimal valid WebP header. */
export const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20])
