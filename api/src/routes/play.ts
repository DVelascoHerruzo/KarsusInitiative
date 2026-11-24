import { currentGuest, currentUser } from '../auth/session'
import { isExpired, redact } from '../domain/tables'
import { HttpError, json, noContent } from '../http'
import type { Services } from '../services'
import { entryId } from '../store/types'
import { param, type Route } from './route'

/** The encounter behind a share token, if the token is real (and, for a guest's, hasn't ended). */
async function sharedEncounter(s: Services, token: string) {
  const link = /^[0-9a-f]{32}$/.test(token) ? await s.store.getEntry(entryId.share(token), 'share') : null
  const doc = link && (await s.store.getTable(link.owner_id, 'encounter', link.encounter_id))?.doc
  return doc && !isExpired(doc, s.now()) ? doc : null
}

/** Who owns tables on this request: the account, or else this browser's guest. */
async function ownerId(s: Services, req: Parameters<typeof currentUser>[1]) {
  return (await currentUser(s, req))?.user_id ?? (await currentGuest(s, req))?.guest_id ?? null
}

export const playRoutes: Route[] = [
  {
    name: 'play',
    route: 'play/{token}',
    methods: {
      async GET(req, s) {
        const encounter = await sharedEncounter(s, param(req, 'token'))
        // Same answer for "no such link" and "link switched off".
        if (!encounter?.share_enabled) throw new HttpError(404, 'This table is closed')
        return json(redact(encounter))
      },
    },
  },
  {
    name: 'live',
    route: 'live/{token}',
    methods: {
      /** A WebSocket URL for the encounter's change pings: for anyone while sharing is on, and always for the owner. */
      async GET(req, s) {
        const token = param(req, 'token')
        const encounter = await sharedEncounter(s, token)
        const allowed = encounter && (encounter.share_enabled || (await ownerId(s, req)) === encounter.owner_id)
        if (!allowed) throw new HttpError(404, 'This table is closed')
        const url = await s.live.clientUrl(token)
        return url ? json({ url }) : noContent()
      },
    },
  },
]
