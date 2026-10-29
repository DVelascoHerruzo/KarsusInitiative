import type { Creature } from '@/lib/types'
import { requireUser } from '../auth/session'
import * as table from '../domain/tables'
import * as v from '../domain/validate'
import { HttpError, json, noContent, readJson } from '../http'
import { entryId } from '../store/types'
import { loadTable, mutateTable, param, type Route } from './route'

export const encounterRoutes: Route[] = [
  {
    name: 'encounters',
    route: 'encounters',
    methods: {
      async GET(req, s) {
        const user = await requireUser(s, req)
        return json((await s.store.listTables(user.user_id, 'encounter')).map(table.encounterSummary))
      },
      async POST(req, s) {
        const user = await requireUser(s, req)
        const doc = table.createEncounter(user.user_id, v.newEncounter(await readJson(req)), s.now())
        // The share link exists from the start (switched off), so turning it on is a single write.
        await s.store.createEntry({ id: entryId.share(doc.share_token), kind: 'share', owner_id: doc.owner_id, encounter_id: doc.id })
        await s.store.createTable(doc)
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
        return json(table.toEncounter(await loadTable(s, user.user_id, 'encounter', param(req, 'id'))))
      },
      async PATCH(req, s) {
        const user = await requireUser(s, req)
        const patch = v.encounterPatch(await readJson(req))
        const doc = await mutateTable(s, user.user_id, 'encounter', param(req, 'id'), (d) => table.patchEncounter(d, patch))
        return json(table.toEncounter(doc))
      },
      async DELETE(req, s) {
        const user = await requireUser(s, req)
        const found = await s.store.getTable(user.user_id, 'encounter', param(req, 'id'))
        if (found) {
          await s.store.deleteEntry(entryId.share(found.doc.share_token))
          await s.store.deleteTable(user.user_id, found.doc.id)
        }
        return noContent()
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
        const doc = await mutateTable(s, user.user_id, 'encounter', param(req, 'id'), (d) => table.advance(d, step))
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
        await mutateTable(s, user.user_id, 'encounter', param(req, 'id'), (d) => {
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
      async PATCH(req, s) {
        const user = await requireUser(s, req)
        const patch = v.creaturePatch(await readJson(req))
        const cid = param(req, 'cid')
        const doc = await mutateTable(s, user.user_id, 'encounter', param(req, 'id'), (d) => table.updateCreature(d, cid, patch))
        return json(doc.creatures.find((c) => c.id === cid))
      },
      async DELETE(req, s) {
        const user = await requireUser(s, req)
        const cid = param(req, 'cid')
        const doc = await mutateTable(s, user.user_id, 'encounter', param(req, 'id'), (d) => table.removeCreature(d, cid))
        return json(table.toEncounter(doc))
      },
    },
  },
]
