import { requireUser } from '../auth/session'
import { characterIdFromUrl, characterJsonUrl, fromDndBeyond, type DdbCharacter } from '../domain/dndbeyond'
import * as v from '../domain/validate'
import { HttpError, json, readJson } from '../http'
import { rateLimit } from '../rate'
import { playerHome } from './collections'
import type { Route } from './route'

const PRIVATE =
  'D&D Beyond wouldn’t share that character. Open it on D&D Beyond, choose Edit → Home → Character Privacy → Public, and try again.'

export const playerRoutes: Route[] = [
  {
    name: 'player-home',
    route: 'player',
    methods: {
      async GET(req, s) {
        const user = await requireUser(s, req)
        return json(await playerHome(s, user.user_id))
      },
    },
  },
  {
    name: 'import-dndbeyond',
    route: 'import/dndbeyond',
    methods: {
      /** Reads a public D&D Beyond character into a draft the player checks before saving. Nothing is stored. */
      async POST(req, s) {
        const user = await requireUser(s, req)
        await rateLimit(s, 'import', user.user_id)
        const body = await readJson(req)
        const id = typeof body.url === 'string' ? characterIdFromUrl(body.url) : null
        if (!id) throw new HttpError(400, 'Paste a D&D Beyond character link, like dndbeyond.com/characters/123456')

        let res: Response
        try {
          res = await s.fetch(characterJsonUrl(id), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) })
        } catch (e) {
          s.log.warn('D&D Beyond fetch failed', e)
          throw new HttpError(502, 'Couldn’t reach D&D Beyond. Try again in a moment.')
        }
        if (res.status === 403 || res.status === 404) throw new HttpError(404, PRIVATE)
        const payload = (await res.json().catch(() => null)) as { success?: boolean; data?: DdbCharacter } | null
        if (!res.ok || !payload?.success || !payload.data) throw new HttpError(502, 'D&D Beyond sent something we couldn’t read. Try again later.')

        // Through the same parsers as anything a browser sends.
        const draft = fromDndBeyond(payload.data)
        return json({ ...v.creaturePatch(draft as Record<string, unknown>), name: draft.name })
      },
    },
  },
]
