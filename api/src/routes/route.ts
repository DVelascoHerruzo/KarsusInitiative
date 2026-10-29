import { HttpError, type ApiRequest, type ApiResponse } from '../http'
import type { Services } from '../services'
import type { DocOf, Kind, TableDoc } from '../store/types'

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'
export type Handler = (req: ApiRequest, s: Services) => Promise<ApiResponse>

/** One Azure Function per route template; the method picks the handler. */
export interface Route {
  name: string
  /** Relative to /api, in Azure Functions template syntax: `encounters/{id}`. */
  route: string
  methods: Partial<Record<Method, Handler>>
}

export function param(req: ApiRequest, name: string): string {
  const value = req.params[name]
  if (!value) throw new HttpError(400, `Missing ${name}`)
  return value
}

const NOT_FOUND = { encounter: 'Encounter not found', preset: 'Preset not found' } satisfies Record<Kind, string>

export async function loadTable<K extends Kind>(s: Services, ownerId: string, kind: K, id: string): Promise<DocOf<K>> {
  const found = await s.store.getTable(ownerId, kind, id)
  if (!found) throw new HttpError(404, NOT_FOUND[kind])
  return found.doc
}

/**
 * Read, change, write back only if nobody else wrote in between; otherwise
 * re-read and apply the change again. Two devices editing different creatures
 * both land.
 */
export async function mutateTable<K extends Kind>(
  s: Services,
  ownerId: string,
  kind: K,
  id: string,
  apply: (doc: DocOf<K>) => DocOf<K>,
): Promise<DocOf<K>> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const found = await s.store.getTable(ownerId, kind, id)
    if (!found) throw new HttpError(404, NOT_FOUND[kind])
    const doc = { ...apply(found.doc), updated_at: s.now().toISOString() }
    if (await s.store.replaceTable(doc, found.etag)) {
      const saved: TableDoc = doc
      if (saved.kind === 'encounter') await s.live.notify(saved.share_token)
      return doc
    }
  }
  throw new HttpError(409, 'Too many edits at once. Try again.')
}
