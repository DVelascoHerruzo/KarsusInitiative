import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { clearGoogleState, finishGoogle, startGoogle, type GoogleProfile } from '../auth/google'
import { hashPassword, isBreached, spendPasswordTime, verifyPassword } from '../auth/password'
import { SESSION_COOKIE, currentUser, expiredCookie, expiredLegacyCookie, publicUser, requireUser, sessionCookie, verificationRequired } from '../auth/session'
import { CONTACT_EMAIL } from '@/lib/legal'
import * as v from '../domain/validate'
import { HttpError, json, noContent, readJson, redirect } from '../http'
import { clientIp, rateLimit } from '../rate'
import type { Services } from '../services'
import { entryId, type UserEntry } from '../store/types'
import type { Route } from './route'

const MAX_FAILED_LOGINS = 10
const LOCKOUT_MS = 15 * 60 * 1000
const RESET_TTL_SECONDS = 60 * 60
const VERIFY_TTL_SECONDS = 48 * 60 * 60

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/** Claims the email first (alias ids are unique), then writes the user. */
async function createUser(s: Services, fields: Pick<UserEntry, 'email' | 'username' | 'password_hash' | 'email_verified' | 'google_sub'>): Promise<UserEntry> {
  const userId = randomUUID()
  if (!(await s.store.createEntry({ id: entryId.email(fields.email), kind: 'alias', user_id: userId }))) {
    throw new HttpError(409, 'An account with that email already exists. Sign in instead.')
  }
  const user: UserEntry = {
    id: entryId.user(userId),
    kind: 'user',
    user_id: userId,
    ...fields,
    session_version: 1,
    failed_logins: 0,
    locked_until: null,
    created_at: s.now().toISOString(),
  }
  await s.store.putEntry(user)
  if (fields.google_sub) await s.store.putEntry({ id: entryId.google(fields.google_sub), kind: 'alias', user_id: userId })
  return user
}

const origin = (s: Services, req: { url: string }) => s.config.publicOrigin ?? new URL(req.url).origin

/** A short, plain email with one button, in the site's colours, under the Karsus emblem. Every email says who to contact. */
function emailHtml(site: string, heading: string, body: string, button: { label: string; href: string }, footnote: string): string {
  const support = CONTACT_EMAIL ? `Questions? Reply to this email or write to <a href="mailto:${CONTACT_EMAIL}" style="color:#2dd4bf">${CONTACT_EMAIL}</a>.` : ''
  return `<div style="background:#050f14;padding:32px 16px;font-family:Georgia,serif;color:#d0eee8">
  <div style="max-width:480px;margin:0 auto;background:#102b38;border:1px solid #1a4055;border-radius:12px;padding:28px">
    <img src="${site}/icons/google-192.png" width="56" height="56" alt="Karsus" style="display:block;margin:0 0 12px;border-radius:50%">
    <p style="margin:0 0 4px;letter-spacing:4px;font-size:12px;color:#2dd4bf">KARSUS INITIATIVE</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#e8a917">${heading}</h1>
    <p style="margin:0 0 24px;line-height:1.6">${body}</p>
    <a href="${button.href}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;letter-spacing:1px">${button.label}</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#4d8a80">${footnote} ${support}</p>
  </div>
</div>`
}

/** Emails a one-time link proving the account's owner reads this inbox. */
export async function sendVerification(s: Services, req: { url: string }, user: UserEntry): Promise<void> {
  if (!s.mail) return
  const token = randomBytes(32).toString('base64url')
  await s.store.putEntry({
    id: entryId.verify(sha256(token)),
    kind: 'verify',
    user_id: user.user_id,
    email: user.email,
    expires_at: s.now().getTime() + VERIFY_TTL_SECONDS * 1000,
    ttl: VERIFY_TTL_SECONDS,
  })
  const link = `${origin(s, req)}/verify-email?token=${token}`
  await s.mail.send({
    to: user.email,
    subject: 'Confirm your email for Karsus',
    text: `Welcome to Karsus Initiative, ${user.username}!\n\nConfirm your email to start using your account: ${link}\n\nThe link works once, for 48 hours. If you didn’t sign up, ignore this email and nothing happens.${CONTACT_EMAIL ? `\n\nQuestions? Reply to this email or write to ${CONTACT_EMAIL}.` : ''}`,
    html: emailHtml(
      origin(s, req),
      `Welcome, ${escapeHtml(user.username)}`,
      'Confirm your email to start using your account. It keeps your account yours: it’s how you’ll reset your password if you ever forget it.',
      { label: 'Confirm my email', href: link },
      'The link works once, for 48 hours. If you didn’t sign up, ignore this email and nothing happens.',
    ),
  })
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** A new password: long enough, and not one that has leaked in a known breach. */
export async function newPassword(s: Services, value: unknown): Promise<string> {
  const password = v.password(value)
  if (await isBreached(password, s.fetch)) {
    throw new HttpError(400, 'That password has appeared in a data breach, so attackers try it first. Choose a different one.')
  }
  return password
}

export async function userByEmail(s: Services, email: string): Promise<UserEntry | null> {
  const alias = await s.store.getEntry(entryId.email(email), 'alias')
  return alias ? s.store.getEntry(entryId.user(alias.user_id), 'user') : null
}

/** Signs in with Google, linking to an existing account with the same email. */
export async function googleUser(s: Services, profile: GoogleProfile): Promise<UserEntry> {
  const linked = await s.store.getEntry(entryId.google(profile.sub), 'alias')
  const byGoogle = linked && (await s.store.getEntry(entryId.user(linked.user_id), 'user'))
  if (byGoogle) return byGoogle

  const existing = await userByEmail(s, profile.email)
  if (!existing) {
    return createUser(s, {
      email: profile.email,
      username: (profile.name ?? profile.email.split('@')[0] ?? 'Adventurer').slice(0, 40),
      password_hash: null,
      email_verified: true,
      google_sub: profile.sub,
    })
  }

  // Google has proven who owns this address. If the account's password was never
  // tied to the address, whoever registered it may not be the owner: drop that
  // password and sign out its sessions before handing the account over.
  const unproven = !existing.email_verified
  const user: UserEntry = {
    ...existing,
    google_sub: profile.sub,
    email_verified: true,
    password_hash: unproven ? null : existing.password_hash,
    session_version: unproven ? existing.session_version + 1 : existing.session_version,
  }
  await s.store.putEntry(user)
  await s.store.putEntry({ id: entryId.google(profile.sub), kind: 'alias', user_id: user.user_id })
  return user
}

export const authRoutes: Route[] = [
  {
    name: 'auth-me',
    route: 'auth/me',
    methods: {
      async GET(req, s) {
        const user = await currentUser(s, req)
        // `google` tells the sign-in page whether to offer "Continue with Google".
        // Every app load renews the session, so people who keep coming back stay signed in.
        const cookies = user ? [expiredLegacyCookie(s, SESSION_COOKIE), await sessionCookie(s, user)] : []
        // `verification` tells the app whether new accounts must confirm their email before using it.
        return json({ user: user && publicUser(user), google: s.config.google !== null, verification: verificationRequired(s) }, 200, { cookies })
      },
      /** Account preferences: the side of the table to open on. */
      async PATCH(req, s) {
        const user = await requireUser(s, req, { allowUnverified: true })
        const body = await readJson(req)
        const updated: UserEntry = {
          ...user,
          ...(body.mode !== undefined ? { mode: v.mode(body.mode) } : {}),
          ...(body.username !== undefined ? { username: v.username(body.username) } : {}),
        }
        await s.store.putEntry(updated)
        return json({ user: publicUser(updated) })
      },
    },
  },
  {
    name: 'auth-signup',
    route: 'auth/signup',
    methods: {
      async POST(req, s) {
        await rateLimit(s, 'signup', clientIp(req))
        const body = await readJson(req)
        const email = v.email(body.email)
        const username = v.username(body.username)
        const password = await newPassword(s, body.password)
        const user = await createUser(s, { email, username, password_hash: await hashPassword(password), email_verified: false, google_sub: null })
        // The account exists either way; if the email fails, the app offers to send it again.
        await sendVerification(s, req, user).catch((e: unknown) => s.log.warn('Verification email failed', e))
        return json({ user: publicUser(user) }, 201, { cookies: [await sessionCookie(s, user)] })
      },
    },
  },
  {
    name: 'auth-signin',
    route: 'auth/signin',
    methods: {
      async POST(req, s) {
        await rateLimit(s, 'signin', clientIp(req))
        const body = await readJson(req)
        const email = v.email(body.email)
        const password = typeof body.password === 'string' ? body.password : ''
        const user = await userByEmail(s, email)
        const now = s.now().getTime()

        if (user?.locked_until && user.locked_until > now) {
          throw new HttpError(429, 'Too many failed attempts. Try again in 15 minutes or reset your password.')
        }
        if (!user?.password_hash) {
          await spendPasswordTime(password)
          throw new HttpError(401, 'Wrong email or password')
        }
        if (!(await verifyPassword(password, user.password_hash))) {
          const failed = user.failed_logins + 1
          await s.store.putEntry({ ...user, failed_logins: failed, locked_until: failed >= MAX_FAILED_LOGINS ? now + LOCKOUT_MS : null })
          throw new HttpError(401, 'Wrong email or password')
        }

        const signedIn = user.failed_logins || user.locked_until ? { ...user, failed_logins: 0, locked_until: null } : user
        if (signedIn !== user) await s.store.putEntry(signedIn)
        return json({ user: publicUser(signedIn) }, 200, { cookies: [await sessionCookie(s, signedIn)] })
      },
    },
  },
  {
    name: 'auth-signout',
    route: 'auth/signout',
    methods: {
      async POST(_req, s) {
        return noContent({ cookies: [expiredLegacyCookie(s, SESSION_COOKIE), expiredCookie(s, SESSION_COOKIE)] })
      },
    },
  },
  {
    name: 'auth-forgot',
    route: 'auth/forgot',
    methods: {
      async POST(req, s) {
        const email = v.email((await readJson(req)).email)
        // Checked before the lookup, so the answer never depends on whether the account exists.
        if (!s.mail) throw new HttpError(503, 'Password reset email isn’t set up on this server')
        // Caps reset emails per address too, so nobody can flood someone's inbox.
        await rateLimit(s, 'forgotByIp', clientIp(req))
        await rateLimit(s, 'forgotByEmail', email)

        const user = await userByEmail(s, email)
        if (user) {
          const token = randomBytes(32).toString('base64url')
          await s.store.putEntry({
            id: entryId.reset(sha256(token)),
            kind: 'reset',
            user_id: user.user_id,
            expires_at: s.now().getTime() + RESET_TTL_SECONDS * 1000,
            ttl: RESET_TTL_SECONDS,
          })
          const link = `${origin(s, req)}/reset-password?token=${token}`
          await s.mail.send({
            to: user.email,
            subject: 'Reset your Karsus password',
            text: `Someone asked to reset the password for your Karsus Initiative account.\n\nChoose a new password: ${link}\n\nThe link works once, for one hour. If you didn’t ask for this, ignore this email.`,
            html: emailHtml(
              origin(s, req),
              'Reset your password',
              'Someone asked to reset the password for your Karsus Initiative account.',
              { label: 'Choose a new password', href: link },
              'The link works once, for one hour. If you didn’t ask for this, ignore this email: your password stays the same.',
            ),
          })
        }
        return noContent()
      },
    },
  },
  {
    name: 'auth-verify',
    route: 'auth/verify',
    methods: {
      /** Opens the link from the verification email. Works on any device, and signs that device in. */
      async POST(req, s) {
        await rateLimit(s, 'reset', clientIp(req))
        const token = (await readJson(req)).token
        const id = entryId.verify(sha256(typeof token === 'string' ? token : ''))
        const entry = typeof token === 'string' && token ? await s.store.getEntry(id, 'verify') : null
        const user = entry && entry.expires_at > s.now().getTime() ? await s.store.getEntry(entryId.user(entry.user_id), 'user') : null
        // A link sent to an earlier address can't confirm a later one.
        if (!user || user.email !== entry?.email) throw new HttpError(400, 'This link has expired or was already used. Sign in and we’ll send a new one.')
        await s.store.deleteEntry(id)
        const verified: UserEntry = { ...user, email_verified: true }
        await s.store.putEntry(verified)
        return json({ user: publicUser(verified) }, 200, { cookies: [await sessionCookie(s, verified)] })
      },
    },
  },
  {
    name: 'auth-verify-resend',
    route: 'auth/verify/resend',
    methods: {
      async POST(req, s) {
        const user = await requireUser(s, req, { allowUnverified: true })
        if (user.email_verified) return noContent()
        if (!s.mail) throw new HttpError(503, 'Email isn’t set up on this server')
        await rateLimit(s, 'verifyEmail', user.user_id)
        await sendVerification(s, req, user)
        return noContent()
      },
    },
  },
  {
    name: 'auth-reset',
    route: 'auth/reset',
    methods: {
      async POST(req, s) {
        await rateLimit(s, 'reset', clientIp(req))
        const body = await readJson(req)
        const password = await newPassword(s, body.password)
        const token = typeof body.token === 'string' ? body.token : ''
        const id = entryId.reset(sha256(token))
        const reset = token ? await s.store.getEntry(id, 'reset') : null
        const user = reset && reset.expires_at > s.now().getTime() ? await s.store.getEntry(entryId.user(reset.user_id), 'user') : null
        if (!user) throw new HttpError(400, 'This reset link has expired or was already used. Ask for a new one.')

        await s.store.deleteEntry(id)
        // The email link proves ownership of the address; every other session ends.
        const updated: UserEntry = {
          ...user,
          password_hash: await hashPassword(password),
          email_verified: true,
          session_version: user.session_version + 1,
          failed_logins: 0,
          locked_until: null,
        }
        await s.store.putEntry(updated)
        return json({ user: publicUser(updated) }, 200, { cookies: [await sessionCookie(s, updated)] })
      },
    },
  },
  {
    name: 'auth-google',
    route: 'auth/google',
    methods: {
      GET: (req, s) => startGoogle(s, req),
    },
  },
  {
    name: 'auth-google-callback',
    route: 'auth/google/callback',
    methods: {
      async GET(req, s) {
        try {
          const { profile, next } = await finishGoogle(s, req)
          const user = await googleUser(s, profile)
          return redirect(next, [clearGoogleState(s), await sessionCookie(s, user)])
        } catch (e) {
          s.log.warn('Google sign-in failed', e)
          return redirect('/login?error=google', [clearGoogleState(s)])
        }
      },
    },
  },
]
