import { CosmosClient, type Container } from '@azure/cosmos'
import type { DocOf, Entry, EntryOf, Kind, Store, TableDoc } from './types'

/**
 * Cosmos DB (NoSQL API). Database layout, created by infra/main.bicep:
 *   tables     partition key /owner_id   encounters and presets, creatures embedded
 *   directory  partition key /id         users, email/Google aliases, share links, reset tokens (TTL on)
 */
export function cosmosStore(connectionString: string, database: string): Store {
  const db = new CosmosClient(connectionString).database(database)
  const tables = db.container('tables')
  const directory = db.container('directory')

  return {
    async listTables<K extends Kind>(ownerId: string, kind: K) {
      const { resources } = await tables.items
        .query<DocOf<K>>(
          {
            query: 'SELECT * FROM c WHERE c.owner_id = @owner AND c.kind = @kind ORDER BY c.updated_at DESC',
            parameters: [
              { name: '@owner', value: ownerId },
              { name: '@kind', value: kind },
            ],
          },
          { partitionKey: ownerId },
        )
        .fetchAll()
      return resources.map(clean)
    },
    async getTable<K extends Kind>(ownerId: string, kind: K, id: string) {
      const resource = await read<DocOf<K>>(tables, id, ownerId)
      if (!resource || resource.kind !== kind) return null
      return { doc: clean(resource), etag: resource._etag }
    },
    async createTable(doc) {
      await tables.items.create(doc)
    },
    async replaceTable(doc, etag) {
      try {
        await tables.item(doc.id, doc.owner_id).replace<TableDoc>(doc, { accessCondition: { type: 'IfMatch', condition: etag } })
        return true
      } catch (e) {
        if (statusOf(e) === 412) return false
        throw e
      }
    },
    async deleteTable(ownerId, id) {
      await ignore404(tables.item(id, ownerId).delete())
    },

    async getEntry<K extends Entry['kind']>(id: string, kind: K) {
      const resource = await read<EntryOf<K>>(directory, id, id)
      return resource?.kind === kind ? clean(resource) : null
    },
    async createEntry(entry) {
      try {
        await directory.items.create(entry)
        return true
      } catch (e) {
        if (statusOf(e) === 409) return false
        throw e
      }
    },
    async putEntry(entry) {
      await directory.items.upsert(entry)
    },
    async deleteEntry(id) {
      await ignore404(directory.item(id, id).delete())
    },
  }
}

type WithSystem<T> = T & { _etag: string; _rid?: string; _self?: string; _ts?: number; _attachments?: string }

async function read<T>(container: Container, id: string, partitionKey: string): Promise<WithSystem<T> | null> {
  try {
    const { resource } = await container.item(id, partitionKey).read<WithSystem<T>>()
    return resource ?? null
  } catch (e) {
    if (statusOf(e) === 404) return null
    throw e
  }
}

/** Drops Cosmos's system properties so documents round-trip cleanly. */
function clean<T>(resource: T): T {
  const { _etag, _rid, _self, _ts, _attachments, ...rest } = resource as WithSystem<T>
  void [_etag, _rid, _self, _ts, _attachments]
  return rest as T
}

/** Cosmos errors carry the HTTP status in `code`. */
function statusOf(e: unknown): number | undefined {
  const code = (e as { code?: unknown } | null)?.code
  return code === undefined ? undefined : Number(code)
}

async function ignore404(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
}
