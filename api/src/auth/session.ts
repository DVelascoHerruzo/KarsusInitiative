import type { Cookie } from '@azure/functions'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { User } from '@/lib/types'
import { HttpError, readCookie, type ApiRequest } from '../http'
import type { Services } from '../services'
import { entryId, type UserEntry } from '../store/types'

// The session is an HS256-signed token in an HttpOnly, SameSite=Lax cookie that
// script can't read. It names the user and their session_version, which is checked
// on every request, so a password reset signs out every other device.

export const SESSION_COOKIE = 'karsus_session'
const SESSION_DAYS = 30

export function signingKey(s: Services): Uint8Array {
  const secret = s.config.sessionSecret
  if (!secret || secret.length < 32) throw new HttpError(503, 'Accounts aren’t configured on this server')
  return new TextEncoder().encode(secret)
}

/** Short-lived signed values (the OAuth state cookie) use the same key as sessions. */
export async function sign(s: Services, claims: JWTPayload, expiresIn: string): Promise<string> {
  return new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(expiresIn).sign(signingKey(s))
}

export async function verify(s: Services, token: string): Promise<JWTPayload | null> {
  try {
    return (await jwtVerify(token, signingKey(s), { algorithms: ['HS256'] })).payload
  } catch {
    return null
  }
}

export function cookie(s: Services, name: string, value: string, maxAgeSeconds: number): Cookie {
  return { name, value, path: '/', httpOnly: true, secure: !s.config.dev, sameSite: 'Lax', maxAge: maxAgeSeconds }
}

export function expiredCookie(s: Services, name: string): Cookie {
  return { ...cookie(s, name, '', 0), expires: new Date(0) }
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

export async function requireUser(s: Services, req: ApiRequest): Promise<UserEntry> {
  const user = await currentUser(s, req)
  if (!user) throw new HttpError(401, 'Sign in to continue')
  return user
}

export const publicUser = (u: UserEntry): User => ({ id: u.user_id, email: u.email, username: u.username })
