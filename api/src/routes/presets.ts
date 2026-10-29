import type { Creature } from '@/lib/types'
import { requireUser } from '../auth/session'
import * as table from '../domain/tables'
import * as v from '../domain/validate'
import { json, noContent, readJson } from '../http'
import { entryId } from '../store/types'
import { loadTable, mutateTable, param, type Route } from './route'

export const presetRoutes: Route[] = [
  {
    name: 'presets',
    route: 'presets',
    methods: {
      async GET(req, s) {
        const user = await requireUser(s, req)
        return json((await s.store.listTables(user.user_id, 'preset')).map(table.presetSummary))
      },
      async POST(req, s) {
        const user = await requireUser(s, req)
        const doc = table.createPreset(user.user_id, v.newPreset(await readJson(req)), s.now())
        await s.store.createTable(doc)
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
        return json(table.toPreset(await loadTable(s, user.user_id, 'preset', param(req, 'id'))))
      },
      async PATCH(req, s) {
        const user = await requireUser(s, req)
        const patch = v.presetPatch(await readJson(req))
        const doc = await mutateTable(s, user.user_id, 'preset', param(req, 'id'), (d) => ({ ...d, ...patch }))
        return json(table.toPreset(doc))
      },
      async DELETE(req, s) {
        const user = await requireUser(s, req)
        await s.store.deleteTable(user.user_id, param(req, 'id'))
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
        const preset = await loadTable(s, user.user_id, 'preset', param(req, 'id'))
        const encounter = table.launchPreset(preset, s.now())
        await s.store.createEntry({ id: entryId.share(encounter.share_token), kind: 'share', owner_id: encounter.owner_id, encounter_id: encounter.id })
        await s.store.createTable(encounter)
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
        await mutateTable(s, user.user_id, 'preset', param(req, 'id'), (d) => {
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
      async PATCH(req, s) {
        const user = await requireUser(s, req)
        const patch = v.creaturePatch(await readJson(req))
        const cid = param(req, 'cid')
        const doc = await mutateTable(s, user.user_id, 'preset', param(req, 'id'), (d) => table.updateCreature(d, cid, patch))
        return json(doc.creatures.find((c) => c.id === cid))
      },
      async DELETE(req, s) {
        const user = await requireUser(s, req)
        const cid = param(req, 'cid')
        await mutateTable(s, user.user_id, 'preset', param(req, 'id'), (d) => table.removeCreature(d, cid))
        return noContent()
      },
    },
  },
]
