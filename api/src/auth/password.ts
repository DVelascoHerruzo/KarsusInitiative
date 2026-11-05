import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

// scrypt at OWASP's recommended cost (N=2^17, r=8, p=1, 128 MiB). The parameters
// are stored with each hash, so raising them later only affects new passwords.

let cost = { N: 2 ** 17, r: 8, p: 1 }
const KEY_LENGTH = 32

/** Tests lower the cost so the suite stays fast. */
export function setPasswordCost(next: { N: number; r: number; p: number }) {
  cost = next
}

function derive(password: string, salt: Buffer, options: ScryptOptions & { N: number; r: number }): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...options, maxmem: 256 * options.N * options.r }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, cost)
  return ['scrypt', cost.N, cost.r, cost.p, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const key = await derive(password, Buffer.from(salt, 'base64'), { N: Number(N), r: Number(r), p: Number(p) })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

let decoy: Promise<string> | null = null

/** Spends the same time as a real check, so unknown emails can't be told apart by response time. */
export async function spendPasswordTime(password: string): Promise<void> {
  decoy ??= hashPassword('karsus-timing-decoy')
  await verifyPassword(password, await decoy)
}

/**
 * Whether a password has shown up in a known data breach, using Have I Been
 * Pwned's range API: only the first 5 characters of its SHA-1 leave the server,
 * never the password. If the service is slow or down, sign-up goes ahead.
 */
export async function isBreached(password: string, fetchFn: typeof fetch): Promise<boolean> {
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase()
  try {
    const res = await fetchFn(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'KarsusInitiative' },
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return false
    const suffix = hash.slice(5)
    return (await res.text()).split('\n').some((line) => {
      const [tail, count] = line.trim().split(':')
      return tail === suffix && Number(count) > 0
    })
  } catch {
    return false
  }
}
