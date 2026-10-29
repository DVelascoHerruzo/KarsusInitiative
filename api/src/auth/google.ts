import { createHash, randomBytes } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { HttpError, queryParam, readCookie, redirect, type ApiRequest, type ApiResponse } from '../http'
import type { Services } from '../services'
import { cookie, expiredCookie, sign, verify } from './session'

// "Continue with Google" as a server-side authorization-code flow with PKCE. The
// browser only ever navigates; no Google script runs on our pages.

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const STATE_COOKIE = 'karsus_oauth'

export interface GoogleProfile {
  sub: string
  email: string
  name: string | null
}

const base64url = (b: Buffer) => b.toString('base64url')

function origin(s: Services, req: ApiRequest) {
  return s.config.publicOrigin ?? new URL(req.url).origin
}

const callbackUrl = (s: Services, req: ApiRequest) => `${origin(s, req)}/api/auth/google/callback`

/** Only same-site paths, so the redirect can't be pointed at another site. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/'
}

export async function startGoogle(s: Services, req: ApiRequest): Promise<ApiResponse> {
  const google = s.config.google
  // This is a page navigation, so answer with a page: back to sign-in, which explains.
  if (!google) return redirect('/login?error=google')

  const verifier = base64url(randomBytes(32))
  const state = base64url(randomBytes(16))
  const nonce = base64url(randomBytes(16))
  const next = safeNext(queryParam(req, 'next'))

  const url = new URL(AUTHORIZE_URL)
  url.search = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: callbackUrl(s, req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: base64url(createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()

  const flow = await sign(s, { state, nonce, verifier, next }, '10m')
  return redirect(url.toString(), [cookie(s, STATE_COOKIE, flow, 600)])
}

/** Checks the returning request against the state cookie and trades the code for a verified Google profile. */
export async function finishGoogle(s: Services, req: ApiRequest): Promise<{ profile: GoogleProfile; next: string }> {
  const google = s.config.google
  if (!google) throw new HttpError(503, 'Google sign-in isn’t configured on this server')

  const stored = readCookie(req, STATE_COOKIE)
  const flow = stored ? await verify(s, stored) : null
  const code = queryParam(req, 'code')
  if (!flow || !code || queryParam(req, 'state') !== flow.state) throw new HttpError(400, 'Google sign-in expired. Try again.')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: google.clientId,
      client_secret: google.clientSecret,
      redirect_uri: callbackUrl(s, req),
      grant_type: 'authorization_code',
      code_verifier: String(flow.verifier),
    }),
  })
  const tokens = (await res.json().catch(() => ({}))) as { id_token?: string }
  if (!res.ok || !tokens.id_token) throw new HttpError(502, 'Google didn’t confirm the sign-in')

  const { payload } = await jwtVerify(tokens.id_token, googleKeys, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: google.clientId,
  })
  if (payload.nonce !== flow.nonce) throw new HttpError(400, 'Google sign-in expired. Try again.')
  if (payload.email_verified !== true || typeof payload.email !== 'string' || !payload.sub) {
    throw new HttpError(400, 'Your Google account has no verified email address')
  }

  return {
    profile: {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: typeof payload.given_name === 'string' ? payload.given_name : typeof payload.name === 'string' ? payload.name : null,
    },
    next: safeNext(flow.next),
  }
}

export const clearGoogleState = (s: Services) => expiredCookie(s, STATE_COOKIE)
