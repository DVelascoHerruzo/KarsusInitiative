import { createHash } from 'node:crypto'
import { HttpError, type ApiRequest } from './http'
import type { Services } from './services'

// Fixed-window rate limits for the endpoints bots go after: sign-up, sign-in,
// password resets, invites, imports and uploads. Counters live in the directory
// and expire on their own. Keys are hashed, so no IP or email is ever stored.
// Cloudflare's rate-limit rule sits in front of this; this is the layer that
// still holds if someone reaches the Azure address directly.

interface Limit {
  /** Requests allowed per window. */
  max: number
  windowSeconds: number
}

export const LIMITS = {
  signup: { max: 10, windowSeconds: 3600 },
  signin: { max: 30, windowSeconds: 600 },
  forgotByEmail: { max: 3, windowSeconds: 3600 },
  forgotByIp: { max: 10, windowSeconds: 3600 },
  reset: { max: 20, windowSeconds: 3600 },
  password: { max: 10, windowSeconds: 3600 },
  invite: { max: 30, windowSeconds: 600 },
  import: { max: 30, windowSeconds: 600 },
  upload: { max: 120, windowSeconds: 3600 },
  account: { max: 5, windowSeconds: 3600 },
  verifyEmail: { max: 4, windowSeconds: 3600 },
} satisfies Record<string, Limit>

/**
 * The caller's address as Azure saw it. Azure's own header can't be set by the
 * client; behind Cloudflare it's Cloudflare's view of the client. Falls back to
 * the first forwarded address, which is only a best effort.
 */
export function clientIp(req: ApiRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-azure-clientip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  ).replace(/:\d+$/, '')
}

const hashKey = (value: string) => createHash('sha256').update(value).digest('base64url').slice(0, 22)

/** Counts one request against `bucket` for `key`, or answers 429 once the window is full. */
export async function rateLimit(s: Services, bucket: keyof typeof LIMITS, key: string): Promise<void> {
  const { max, windowSeconds } = LIMITS[bucket]
  const now = s.now().getTime()
  const window = Math.floor(now / (windowSeconds * 1000))
  const id = `rate:${bucket}:${hashKey(key)}:${window}`
  const entry = await s.store.getEntry(id, 'rate')
  const count = (entry?.count ?? 0) + 1
  if (count > max) {
    const wait = Math.ceil(((window + 1) * windowSeconds * 1000 - now) / 60_000)
    throw new HttpError(429, `Too many attempts. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`)
  }
  // Approximate under heavy concurrency, which is fine for a limit.
  await s.store.putEntry({ id, kind: 'rate', count, ttl: windowSeconds + 60 })
}
