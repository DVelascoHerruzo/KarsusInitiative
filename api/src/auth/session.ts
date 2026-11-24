import type { Cookie } from '@azure/functions'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { User } from '@/lib/types'
import { HttpError, readCookie, type ApiRequest } from '../http'
import type { Services } from '../services'
import { entryId, type UserEntry } from '../store/types'

// The session is an HS256-signed token in an HttpOnly, SameSite=Lax cookie that
// script can't read. It names the user and their session_version, which is checked
// on every request, so a password reset signs out every other device. Each visit
// renews it (see auth/me), so only a year away from the site signs you out.

export const SESSION_COOKIE = 'karsus_session'
const SESSION_DAYS = 365

function signingKey(s: Services): Uint8Array {
  const secret = s.config.sessionSecret
  if (!secret || secret.length < 32) throw new HttpError(503, 'Accounts aren’t configured on this server')
  return new TextEncoder().encode(secret)
}

/** Short-lived signed values (the OAuth state cookie, the guest cookie) use the same key as sessions. */
export async function sign(s: Services, claims: JWTPayload, expiresIn: string | number): Promise<string> {
  return new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(expiresIn).sign(signingKey(s))
}

export async function verify(s: Services, token: string): Promise<JWTPayload | null> {
  try {
    return (await jwtVerify(token, signingKey(s), { algorithms: ['HS256'] })).payload
  } catch {
    return null
  }
}

/**
 * Cookies are scoped to /api: only the API reads them, so the browser doesn't
 * attach them to every page, script, font and image request.
 */
export function cookie(s: Services, name: string, value: string, maxAgeSeconds: number): Cookie {
  return { name, value, path: '/api', httpOnly: true, secure: !s.config.dev, sameSite: 'Lax', maxAge: maxAgeSeconds }
}

export function expiredCookie(s: Services, name: string): Cookie {
  return { ...cookie(s, name, '', 0), expires: new Date(0) }
}

/** Before cookies moved to /api they were set on the whole site; this clears that old copy. */
export function expiredLegacyCookie(s: Services, name: string): Cookie {
  return { ...expiredCookie(s, name), path: '/' }
}

export async function sessionCookie(s: Services, user: UserEntry): Promise<Cookie> {
  const token = await sign(s, { sub: user.user_id, ver: user.session_version }, `${SESSION_DAYS}d`)
  return cookie(s, SESSION_COOKIE, token, SESSION_DAYS * 24 * 60 * 60)
}

export async function currentUser(s: Services, req: ApiRequest): Promise<UserEntry | null> {
  const token = readCookie(req, SESSION_COOKIE)
  if (!token) return null
  const claims = await verify(s, token)
  if (!claims?.sub) return null
  const user = await s.store.getEntry(entryId.user(claims.sub), 'user')
  return user && user.session_version === claims.ver ? user : null
}

/** Whether accounts must confirm their email before using the site: only where email can be sent. */
export const verificationRequired = (s: Services) => s.mail !== null

function checkVerified(s: Services, user: UserEntry, allowUnverified = false) {
  if (!user.email_verified && !allowUnverified && verificationRequired(s)) {
    throw new HttpError(403, 'Confirm your email first: open the link we sent you.')
  }
}

/**
 * The signed-in account, or 401. Until the email is confirmed (403), only the
 * account's own routes work: verifying, resending, settings, export and deletion.
 */
export async function requireUser(s: Services, req: ApiRequest, opts: { allowUnverified?: boolean } = {}): Promise<UserEntry> {
  const user = await currentUser(s, req)
  if (!user) throw new HttpError(401, 'Sign in to continue')
  checkVerified(s, user, opts.allowUnverified)
  return user
}

// ─── Guests ──────────────────────────────────────────────────────────────────
// Anyone can run an encounter without an account. Their first change creates it,
// owned by a random guest id that only this signed cookie knows. It ends at a
// fixed time (cookie and encounter together), unless they sign up or sign in,
// which moves it into their account.

export const GUEST_COOKIE = 'karsus_guest'
export const GUEST_DAYS = 7

export interface Guest {
  guest_id: string
  encounter_id: string
  expires_at: string
}

export async function guestCookie(s: Services, guest: Guest): Promise<Cookie> {
  const exp = Math.floor(Date.parse(guest.expires_at) / 1000)
  const token = await sign(s, { sub: guest.guest_id, enc: guest.encounter_id, gst: true }, exp)
  return cookie(s, GUEST_COOKIE, token, Math.max(0, exp - Math.floor(s.now().getTime() / 1000)))
}

/** This browser's guest, if it has one that hasn't ended. */
export async function currentGuest(s: Services, req: ApiRequest): Promise<Guest | null> {
  const token = readCookie(req, GUEST_COOKIE)
  const claims = token ? await verify(s, token) : null
  if (!claims || claims.gst !== true || typeof claims.sub !== 'string' || typeof claims.enc !== 'string' || !claims.exp) return null
  return { guest_id: claims.sub, encounter_id: claims.enc, expires_at: new Date(claims.exp * 1000).toISOString() }
}

/**
 * Whoever owns tables on this request: the signed-in account (with requireUser's
 * rules), or else this browser's guest. Only for the routes a guest may use:
 * running their own encounter, never campaigns, invites, folders or uploads.
 */
export async function requireUserOrGuest(s: Services, req: ApiRequest): Promise<{ user_id: string; guest: boolean }> {
  const user = await currentUser(s, req)
  if (user) {
    checkVerified(s, user)
    return { user_id: user.user_id, guest: false }
  }
  const guest = await currentGuest(s, req)
  if (guest) return { user_id: guest.guest_id, guest: true }
  throw new HttpError(401, 'Sign in to continue')
}

export const publicUser = (u: UserEntry): User => ({
  id: u.user_id,
  email: u.email,
  username: u.username,
  mode: u.mode ?? 'dm',
  sign_in: { password: u.password_hash !== null, google: u.google_sub !== null },
  email_verified: u.email_verified,
  verification_sent_at: u.verify_sent_at ?? null,
})
