import type { Creature, PlayerEncounter } from '@/lib/types'
import { requireUser } from '../auth/session'
import * as table from '../domain/tables'
import * as v from '../domain/validate'
import { HttpError, json, noContent, readJson } from '../http'
import { entryId } from '../store/types'
import { dmEncounters, LIVE_FOR_MS, liveIds } from './collections'
import { createTable, deleteTable, mutateTable, openTable, param, type Route } from './route'

export const encounterRoutes: Route[] = [
  {
    name: 'encounters',
    route: 'encounters',
    methods: {
      /** Every encounter the caller can run: their own, and those they co-DM directly or through a campaign. */
      async GET(req, s) {
        const user = await requireUser(s, req)
        const docs = await dmEncounters(s, user.user_id)
        const live = await liveIds(s, docs.map((d) => d.id))
        return json(docs.map((d) => table.encounterSummary(d, live.has(d.id))))
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
        const id = param(req, 'id')
        if (patch.campaign_id) {
          // A folder is a preset. Its players see every encounter in it, so the caller must run both,
          // and they must share an owner: a campaign's encounters are stored with it.
          const { doc: encounter } = await openTable(s, user.user_id, 'encounter', id, 'dm')
          const { doc: preset } = await openTable(s, user.user_id, 'preset', patch.campaign_id, 'dm')
          if (preset.owner_id !== encounter.owner_id) throw new HttpError(400, 'That folder belongs to another DM')
        }
        const doc = await mutateTable(s, user.user_id, 'encounter', id, 'dm', (d) => table.patchEncounter(d, patch))
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
        const mine = doc.creatures.filter((c) => c.player_id === user.user_id && !c.hidden)
        const view: PlayerEncounter = {
          ...table.redact(doc),
          id: doc.id,
          mine: mine.map((c) => c.id),
          characters: mine.map(table.ownCharacter),
          campaign: campaign && { id: campaign.id, name: campaign.name },
        }
        return json(view)
      },
    },
  },
  {
    name: 'encounter-presence',
    route: 'encounters/{id}/presence',
    methods: {
      /** The DM's screen beats every 20 seconds while the encounter is open, which marks it live. */
      async POST(req, s) {
        const user = await requireUser(s, req)
        const { doc } = await openTable(s, user.user_id, 'encounter', param(req, 'id'), 'dm')
        await s.store.putEntry({ id: entryId.presence(doc.id), kind: 'presence', at: s.now().getTime(), ttl: Math.ceil(LIVE_FOR_MS / 1000) * 2 })
        return noContent()
      },
      /** The DM left the screen. */
      async DELETE(req, s) {
        const user = await requireUser(s, req)
        const { doc } = await openTable(s, user.user_id, 'encounter', param(req, 'id'), 'dm')
        await s.store.deleteEntry(entryId.presence(doc.id))
        return noContent()
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
