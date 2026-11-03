import type { CharacterChoice, Creature } from '@/lib/types'
import { requireUser } from '../auth/session'
import * as table from '../domain/tables'
import * as v from '../domain/validate'
import { HttpError, json, noContent, readJson } from '../http'
import type { PresetDoc, TableDoc } from '../store/types'
import { campaignView, dmPresets } from './collections'
import { createTable, deleteTable, mutateTable, openTable, param, syncCampaign, type Route } from './route'

/** Gives a player the character they chose, freeing whichever one they had. */
export function applyChoice<T extends TableDoc>(doc: T, userId: string, choice: CharacterChoice, now: Date): T {
  if ('claim' in choice) return table.claimCharacter(doc, userId, choice.claim)
  return table.addCreatures(table.releaseCharacters(doc, userId), [choice.create], now, userId).doc
}

export const presetRoutes: Route[] = [
  {
    name: 'presets',
    route: 'presets',
    methods: {
      async GET(req, s) {
        const user = await requireUser(s, req)
        return json((await dmPresets(s, user.user_id)).map(table.presetSummary))
      },
      async POST(req, s) {
        const user = await requireUser(s, req)
        const doc = table.createPreset(user.user_id, v.newPreset(await readJson(req)), s.now())
        await createTable(s, doc)
        return json({ id: doc.id }, 201)
      },
    },
  },
  {
    name: 'preset',
    route: 'presets/{id}',
    methods: {
      async GET(req, s) {
        const user = await requireUser(s, req)
        return json(table.toPreset((await openTable(s, user.user_id, 'preset', param(req, 'id'), 'dm')).doc))
      },
      async PATCH(req, s) {
        const user = await requireUser(s, req)
        const patch = v.presetPatch(await readJson(req))
        const doc = await mutateTable(s, user.user_id, 'preset', param(req, 'id'), 'dm', (d) => ({ ...d, ...patch }))
        return json(table.toPreset(doc))
      },
      async DELETE(req, s) {
        const user = await requireUser(s, req)
        try {
          await deleteTable(s, (await openTable(s, user.user_id, 'preset', param(req, 'id'), 'owner')).doc)
        } catch (e) {
          if (!(e instanceof HttpError && e.status === 404)) throw e
        }
        return noContent()
      },
    },
  },
  {
    name: 'preset-launch',
    route: 'presets/{id}/launch',
    methods: {
      async POST(req, s) {
        const user = await requireUser(s, req)
        const { doc: preset } = await openTable(s, user.user_id, 'preset', param(req, 'id'), 'dm')
        const encounter = table.launchPreset(preset, s.now())
        await createTable(s, encounter)
        return json({ id: encounter.id }, 201)
      },
    },
  },
  {
    name: 'preset-creatures',
    route: 'presets/{id}/creatures',
    methods: {
      async POST(req, s) {
        const user = await requireUser(s, req)
        const input = v.newCreatures(await readJson(req))
        let added: Creature[] = []
        await mutateTable(s, user.user_id, 'preset', param(req, 'id'), 'dm', (d) => {
          const out = table.addCreatures(d, input, s.now())
          added = out.added
          return out.doc
        })
        return json(added, 201)
      },
    },
  },
  {
    name: 'preset-creature',
    route: 'presets/{id}/creatures/{cid}',
    methods: {
      /** The DM changes anything; a player changes their own character's sheet. Either way, its copies in running encounters follow. */
      async PATCH(req, s) {
        const user = await requireUser(s, req)
        const patch = v.creaturePatch(await readJson(req))
        const cid = param(req, 'cid')
        let asPlayer = false
        const doc = await mutateTable(s, user.user_id, 'preset', param(req, 'id'), 'player', (d, access) => {
          asPlayer = access === 'player'
          if (asPlayer) {
            const target = d.creatures.find((c) => c.id === cid)
            if (!target || target.hidden || target.player_id !== user.user_id) throw new HttpError(403, 'You can only change your own character')
            v.onlyFields(patch, v.PLAYER_SHEET_FIELDS)
          }
          return table.updateCreature(d, cid, patch)
        })
        await syncCampaign(s, doc)
        const creature = doc.creatures.find((c) => c.id === cid)!
        return json(asPlayer ? table.ownCharacter(creature) : creature)
      },
      async DELETE(req, s) {
        const user = await requireUser(s, req)
        const cid = param(req, 'cid')
        await mutateTable(s, user.user_id, 'preset', param(req, 'id'), 'dm', (d) => table.removeCreature(d, cid))
        return noContent()
      },
    },
  },
  {
    name: 'campaign',
    route: 'presets/{id}/campaign',
    methods: {
      /** The campaign from the caller's seat as a player. */
      async GET(req, s) {
        const user = await requireUser(s, req)
        const { doc } = await openTable(s, user.user_id, 'preset', param(req, 'id'), 'player')
        return json(await campaignView(s, doc, user.user_id))
      },
    },
  },
  {
    name: 'campaign-character',
    route: 'presets/{id}/character',
    methods: {
      /** Switch to an unclaimed character, or make a new one. */
      async POST(req, s) {
        const user = await requireUser(s, req)
        const choice = v.characterChoice(await readJson(req))
        const doc: PresetDoc = await mutateTable(s, user.user_id, 'preset', param(req, 'id'), 'player', (d, access) => {
          if (access !== 'player') throw new HttpError(400, 'DMs don’t pick a character. Add one to the roster instead.')
          return applyChoice(d, user.user_id, choice, s.now())
        })
        await syncCampaign(s, doc)
        return json(await campaignView(s, doc, user.user_id))
      },
    },
  },
]
