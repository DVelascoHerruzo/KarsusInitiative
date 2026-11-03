import type { Creature, PlayerEncounter } from '@/lib/types'
import { requireUser } from '../auth/session'
import * as table from '../domain/tables'
import * as v from '../domain/validate'
import { HttpError, json, noContent, readJson } from '../http'
import { dmEncounters } from './collections'
import { createTable, deleteTable, mutateTable, openTable, param, type Route } from './route'

export const encounterRoutes: Route[] = [
  {
    name: 'encounters',
    route: 'encounters',
    methods: {
      /** Every encounter the caller can run: their own, and those they co-DM directly or through a campaign. */
      async GET(req, s) {
        const user = await requireUser(s, req)
        return json((await dmEncounters(s, user.user_id)).map(table.encounterSummary))
      },
      async POST(req, s) {
        const user = await requireUser(s, req)
        const doc = table.createEncounter(user.user_id, v.newEncounter(await readJson(req)), s.now())
        await createTable(s, doc)
        return json({ id: doc.id }, 201)
      },
    },
  },
  {
    name: 'encounter',
    route: 'encounters/{id}',
    methods: {
      async GET(req, s) {
        const user = await requireUser(s, req)
        return json(table.toEncounter((await openTable(s, user.user_id, 'encounter', param(req, 'id'), 'dm')).doc))
      },
      async PATCH(req, s) {
        const user = await requireUser(s, req)
        const patch = v.encounterPatch(await readJson(req))
        const doc = await mutateTable(s, user.user_id, 'encounter', param(req, 'id'), 'dm', (d) => table.patchEncounter(d, patch))
        return json(table.toEncounter(doc))
      },
      async DELETE(req, s) {
        const user = await requireUser(s, req)
        try {
          await deleteTable(s, (await openTable(s, user.user_id, 'encounter', param(req, 'id'), 'owner')).doc)
        } catch (e) {
          // Deleting twice is fine; deleting someone else's encounter isn't.
          if (!(e instanceof HttpError && e.status === 404)) throw e
        }
        return noContent()
      },
    },
  },
  {
    name: 'encounter-view',
    route: 'encounters/{id}/view',
    methods: {
      /** The player view for a signed-in player, marking which creatures are theirs to update. */
      async GET(req, s) {
        const user = await requireUser(s, req)
        const { doc, campaign } = await openTable(s, user.user_id, 'encounter', param(req, 'id'), 'player')
        const view: PlayerEncounter = {
          ...table.redact(doc),
          id: doc.id,
          mine: doc.creatures.filter((c) => c.player_id === user.user_id && !c.hidden).map((c) => c.id),
          campaign: campaign && { id: campaign.id, name: campaign.name },
        }
        return json(view)
      },
    },
  },
  {
    name: 'encounter-live',
    route: 'encounters/{id}/live',
    methods: {
      /** A WebSocket URL for the encounter's change pings, for anyone at the table. */
      async GET(req, s) {
        const user = await requireUser(s, req)
        const { doc } = await openTable(s, user.user_id, 'encounter', param(req, 'id'), 'player')
        const url = await s.live.clientUrl(doc.share_token)
        return url ? json({ url }) : noContent()
      },
    },
  },
  {
    name: 'encounter-turn',
    route: 'encounters/{id}/turn',
    methods: {
      async POST(req, s) {
        const user = await requireUser(s, req)
        const { step } = await readJson(req)
        if (step !== 1 && step !== -1) throw new HttpError(400, 'Step must be 1 or -1')
        const doc = await mutateTable(s, user.user_id, 'encounter', param(req, 'id'), 'dm', (d) => table.advance(d, step))
        return json(table.toEncounter(doc))
      },
    },
  },
  {
    name: 'encounter-creatures',
    route: 'encounters/{id}/creatures',
    methods: {
      async POST(req, s) {
        const user = await requireUser(s, req)
        const input = v.newCreatures(await readJson(req))
        let added: Creature[] = []
        await mutateTable(s, user.user_id, 'encounter', param(req, 'id'), 'dm', (d) => {
          const out = table.addCreatures(d, input, s.now())
          added = out.added
          return out.doc
        })
        return json(added, 201)
      },
    },
  },
  {
    name: 'encounter-creature',
    route: 'encounters/{id}/creatures/{cid}',
    methods: {
      /** The DM changes anything; a player changes their own character's HP and conditions. */
      async PATCH(req, s) {
        const user = await requireUser(s, req)
        const patch = v.creaturePatch(await readJson(req))
        const cid = param(req, 'cid')
        let asPlayer = false
        const doc = await mutateTable(s, user.user_id, 'encounter', param(req, 'id'), 'player', (d, access) => {
          asPlayer = access === 'player'
          if (asPlayer) {
            const target = d.creatures.find((c) => c.id === cid)
            if (!target || target.hidden || target.player_id !== user.user_id) throw new HttpError(403, 'You can only change your own character')
            v.onlyFields(patch, v.PLAYER_COMBAT_FIELDS)
          }
          return table.updateCreature(d, cid, patch)
        })
        const creature = doc.creatures.find((c) => c.id === cid)!
        return json(asPlayer ? table.ownCharacter(creature) : creature)
      },
      async DELETE(req, s) {
        const user = await requireUser(s, req)
        const cid = param(req, 'cid')
        const doc = await mutateTable(s, user.user_id, 'encounter', param(req, 'id'), 'dm', (d) => table.removeCreature(d, cid))
        return json(table.toEncounter(doc))
      },
    },
  },
]
