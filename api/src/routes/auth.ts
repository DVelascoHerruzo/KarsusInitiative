import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { clearGoogleState, finishGoogle, startGoogle, type GoogleProfile } from '../auth/google'
import { hashPassword, spendPasswordTime, verifyPassword } from '../auth/password'
import { SESSION_COOKIE, currentUser, expiredCookie, publicUser, sessionCookie } from '../auth/session'
import * as v from '../domain/validate'
import { HttpError, json, noContent, readJson, redirect } from '../http'
import type { Services } from '../services'
import { entryId, type UserEntry } from '../store/types'
import type { Route } from './route'

const MAX_FAILED_LOGINS = 10
const LOCKOUT_MS = 15 * 60 * 1000
const RESET_TTL_SECONDS = 60 * 60

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

async function userByEmail(s: Services, email: string): Promise<UserEntry | null> {
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
        return json({ user: user && publicUser(user), google: s.config.google !== null })
      },
    },
  },
  {
    name: 'auth-signup',
    route: 'auth/signup',
    methods: {
      async POST(req, s) {
        const body = await readJson(req)
        const email = v.email(body.email)
        const username = v.username(body.username)
        const password = v.password(body.password)
        const user = await createUser(s, { email, username, password_hash: await hashPassword(password), email_verified: false, google_sub: null })
        return json({ user: publicUser(user) }, 201, { cookies: [await sessionCookie(s, user)] })
      },
    },
  },
  {
    name: 'auth-signin',
    route: 'auth/signin',
    methods: {
      async POST(req, s) {
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
        return noContent({ cookies: [expiredCookie(s, SESSION_COOKIE)] })
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
          const link = `${s.config.publicOrigin ?? new URL(req.url).origin}/reset-password?token=${token}`
          await s.mail.send({
            to: user.email,
            subject: 'Reset your Karsus password',
            text: `Someone asked to reset the password for your Karsus Initiative account.\n\nChoose a new password: ${link}\n\nThe link works once, for one hour. If you didn’t ask for this, ignore this email.`,
            html: `<p>Someone asked to reset the password for your Karsus Initiative account.</p><p><a href="${link}">Choose a new password</a></p><p>The link works once, for one hour. If you didn’t ask for this, ignore this email.</p>`,
          })
        }
        return noContent()
      },
    },
  },
  {
    name: 'auth-reset',
    route: 'auth/reset',
    methods: {
      async POST(req, s) {
        const body = await readJson(req)
        const password = v.password(body.password)
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
