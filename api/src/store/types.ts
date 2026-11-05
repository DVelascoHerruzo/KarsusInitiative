import type { Encounter, Folders, Mode, Preset, Role } from '@/lib/types'

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
  /** The side of the table they were on last; missing on older accounts. */
  mode?: Mode
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

/** Where a table lives: tables are partitioned by owner, and members only know the id. */
export interface TableEntry {
  id: string
  kind: 'table'
  owner_id: string
  table_kind: Kind
}

/** An invite link: whoever opens it joins the table with this role. */
export interface InviteEntry {
  id: string
  kind: 'invite'
  owner_id: string
  table_id: string
  table_kind: Kind
  role: Role
}

export interface ResetEntry {
  id: string
  kind: 'reset'
  user_id: string
  expires_at: number
  /** Cosmos deletes the document after this many seconds. */
  ttl: number
}

/** A DM has the encounter open. Refreshed by a heartbeat; Cosmos removes it soon after the DM leaves. */
export interface PresenceEntry {
  id: string
  kind: 'presence'
  /** When the heartbeat last arrived, in ms. */
  at: number
  ttl: number
}

/** A person's own encounter folders: one document per account. */
export interface FoldersEntry extends Folders {
  id: string
  kind: 'folders'
}

/** A rate-limit counter for one window. The key is hashed into the id. */
export interface RateEntry {
  id: string
  kind: 'rate'
  count: number
  ttl: number
}

export type Entry = UserEntry | AliasEntry | ShareEntry | TableEntry | InviteEntry | ResetEntry | PresenceEntry | FoldersEntry | RateEntry
export type EntryOf<K extends Entry['kind']> = Extract<Entry, { kind: K }>

/** Item ids can't contain / \ ? #, so free text is URI-encoded. */
export const entryId = {
  user: (userId: string) => `user:${userId}`,
  email: (email: string) => `email:${encodeURIComponent(email)}`,
  google: (sub: string) => `google:${encodeURIComponent(sub)}`,
  share: (token: string) => `share:${token}`,
  table: (tableId: string) => `table:${tableId}`,
  invite: (token: string) => `invite:${token}`,
  reset: (tokenHash: string) => `reset:${tokenHash}`,
  presence: (encounterId: string) => `presence:${encounterId}`,
  folders: (userId: string) => `folders:${userId}`,
}

export interface Store {
  listTables<K extends Kind>(ownerId: string, kind: K): Promise<DocOf<K>[]>
  getTable<K extends Kind>(ownerId: string, kind: K, id: string): Promise<{ doc: DocOf<K>; etag: string } | null>
  createTable(doc: TableDoc): Promise<void>
  /** Writes only if the document is unchanged since `etag` was read; false means re-read and retry. */
  replaceTable(doc: TableDoc, etag: string): Promise<boolean>
  deleteTable(ownerId: string, id: string): Promise<void>
  /** Tables of this kind, across every owner, that list the user as a member. */
  listJoinedTables<K extends Kind>(userId: string, kind: K): Promise<DocOf<K>[]>
  /** The encounters launched from any of these campaigns; a campaign's encounters share its owner. */
  listCampaignEncounters(ownerId: string, campaignIds: readonly string[]): Promise<EncounterDoc[]>

  getEntry<K extends Entry['kind']>(id: string, kind: K): Promise<EntryOf<K> | null>
  /** False when an entry with that id already exists. */
  createEntry(entry: Entry): Promise<boolean>
  putEntry(entry: Entry): Promise<void>
  deleteEntry(id: string): Promise<void>
}
