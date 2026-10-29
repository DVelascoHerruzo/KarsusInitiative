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
  call(method: string, path: string, opts?: { body?: unknown; raw?: Uint8Array; type?: string; origin?: string; cookie?: string }): Promise<Res>
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

export type Client = (method: string, path: string, opts?: { body?: unknown; raw?: Uint8Array; type?: string; origin?: string }) => Promise<Res>

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

export function testApp(overrides: { store?: Store; env?: Record<string, string> } = {}): TestApp {
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
  const images: Images = {
    async put(path) {
      return `https://images.test/${path}`
    },
  }
  const mailer: Mail = {
    async send(m) {
      mail.push(m)
    },
  }
  const s: Services = {
    config: readConfig({ SESSION_SECRET: 'test-secret-that-is-at-least-32-characters', PUBLIC_ORIGIN: ORIGIN, ...overrides.env }),
    store: overrides.store ?? memoryStore(),
    live,
    images,
    mail: mailer,
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
export async function signedUp(app: TestApp, email = 'dm@example.com') {
  const api = app.client()
  const res = await api('POST', '/api/auth/signup', { body: { email, username: 'Dungeon Master', password: 'correct horse battery' } })
  if (res.status !== 201) throw new Error(`signup failed: ${JSON.stringify(res.body)}`)
  return { api, user: res.body.user as { id: string; email: string; username: string } }
}

/** A minimal valid WebP header. */
export const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20])
