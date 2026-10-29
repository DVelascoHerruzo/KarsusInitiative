import type { DocOf, Entry, EntryOf, Kind, Store, TableDoc } from './types'

/**
 * Everything in process memory, with the same ETag semantics as Cosmos. Used by
 * the tests and by `func start` when KARSUS_DEV=1 and no Cosmos is configured.
 */
export function memoryStore(): Store {
  const tables = new Map<string, { doc: TableDoc; etag: string }>()
  const entries = new Map<string, Entry>()
  let version = 0
  const tag = () => `"${++version}"`
  const key = (ownerId: string, id: string) => `${ownerId}/${id}`

  return {
    async listTables<K extends Kind>(ownerId: string, kind: K) {
      return [...tables.values()]
        .map((t) => t.doc)
        .filter((d): d is DocOf<K> => d.owner_id === ownerId && d.kind === kind)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((d) => structuredClone(d))
    },
    async getTable<K extends Kind>(ownerId: string, kind: K, id: string) {
      const found = tables.get(key(ownerId, id))
      if (!found || found.doc.kind !== kind) return null
      return { doc: structuredClone(found.doc) as DocOf<K>, etag: found.etag }
    },
    async createTable(doc) {
      if (tables.has(key(doc.owner_id, doc.id))) throw new Error(`Table ${doc.id} already exists`)
      tables.set(key(doc.owner_id, doc.id), { doc: structuredClone(doc), etag: tag() })
    },
    async replaceTable(doc, etag) {
      const current = tables.get(key(doc.owner_id, doc.id))
      if (!current || current.etag !== etag) return false
      tables.set(key(doc.owner_id, doc.id), { doc: structuredClone(doc), etag: tag() })
      return true
    },
    async deleteTable(ownerId, id) {
      tables.delete(key(ownerId, id))
    },

    async getEntry<K extends Entry['kind']>(id: string, kind: K) {
      const entry = entries.get(id)
      return entry?.kind === kind ? (structuredClone(entry) as EntryOf<K>) : null
    },
    async createEntry(entry) {
      if (entries.has(entry.id)) return false
      entries.set(entry.id, structuredClone(entry))
      return true
    },
    async putEntry(entry) {
      entries.set(entry.id, structuredClone(entry))
    },
    async deleteEntry(id) {
      entries.delete(id)
    },
  }
}
