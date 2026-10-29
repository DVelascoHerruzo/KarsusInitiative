import { currentUser } from '../auth/session'
import { redact } from '../domain/tables'
import { HttpError, json, noContent } from '../http'
import type { Services } from '../services'
import { entryId } from '../store/types'
import { param, type Route } from './route'

/** The encounter behind a share token, if the token is real. */
async function sharedEncounter(s: Services, token: string) {
  const link = /^[0-9a-f]{32}$/.test(token) ? await s.store.getEntry(entryId.share(token), 'share') : null
  return link && (await s.store.getTable(link.owner_id, 'encounter', link.encounter_id))?.doc
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
        const allowed = encounter && (encounter.share_enabled || (await currentUser(s, req))?.user_id === encounter.owner_id)
        if (!allowed) throw new HttpError(404, 'This table is closed')
        const url = await s.live.clientUrl(token)
        return url ? json({ url }) : noContent()
      },
    },
  },
]
