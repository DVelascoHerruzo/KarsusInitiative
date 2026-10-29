import type { Encounter, Preset } from '@/lib/types'

// ─── Tables: encounters and presets ──────────────────────────────────────────
// One document per encounter or preset, with its creatures embedded, partitioned
// by owner. Every write is a compare-and-swap on the document's ETag, so two
// devices editing at once retry instead of overwriting each other.

export type EncounterDoc = Encounter & { kind: 'encounter' }
export type PresetDoc = Preset & { kind: 'preset' }
export type TableDoc = EncounterDoc | PresetDoc
export type Kind = TableDoc['kind']
export type DocOf<K extends Kind> = Extract<TableDoc, { kind: K }>

// ─── Directory: accounts and lookups ─────────────────────────────────────────
// Keyed documents, each its own partition, so every lookup is a point read.

export interface UserEntry {
  id: string
  kind: 'user'
  user_id: string
  email: string
  username: string
  /** scrypt hash, or null for accounts that only sign in with Google. */
  password_hash: string | null
  /** True once the owner proved the address: a reset link or Google. */
  email_verified: boolean
  google_sub: string | null
  /** Bumped on password change; sessions carrying an older version stop working. */
  session_version: number
  failed_logins: number
  locked_until: number | null
  created_at: string
}

/** Points a unique key (an email, a Google account) at a user. Creating it is what claims the key. */
export interface AliasEntry {
  id: string
  kind: 'alias'
  user_id: string
}

export interface ShareEntry {
  id: string
  kind: 'share'
  owner_id: string
  encounter_id: string
}

export interface ResetEntry {
  id: string
  kind: 'reset'
  user_id: string
  expires_at: number
  /** Cosmos deletes the document after this many seconds. */
  ttl: number
}

export type Entry = UserEntry | AliasEntry | ShareEntry | ResetEntry
export type EntryOf<K extends Entry['kind']> = Extract<Entry, { kind: K }>

/** Item ids can't contain / \ ? #, so free text is URI-encoded. */
export const entryId = {
  user: (userId: string) => `user:${userId}`,
  email: (email: string) => `email:${encodeURIComponent(email)}`,
  google: (sub: string) => `google:${encodeURIComponent(sub)}`,
  share: (token: string) => `share:${token}`,
  reset: (tokenHash: string) => `reset:${tokenHash}`,
}

export interface Store {
  listTables<K extends Kind>(ownerId: string, kind: K): Promise<DocOf<K>[]>
  getTable<K extends Kind>(ownerId: string, kind: K, id: string): Promise<{ doc: DocOf<K>; etag: string } | null>
  createTable(doc: TableDoc): Promise<void>
  /** Writes only if the document is unchanged since `etag` was read; false means re-read and retry. */
  replaceTable(doc: TableDoc, etag: string): Promise<boolean>
  deleteTable(ownerId: string, id: string): Promise<void>

  getEntry<K extends Entry['kind']>(id: string, kind: K): Promise<EntryOf<K> | null>
  /** False when an entry with that id already exists. */
  createEntry(entry: Entry): Promise<boolean>
  putEntry(entry: Entry): Promise<void>
  deleteEntry(id: string): Promise<void>
}
