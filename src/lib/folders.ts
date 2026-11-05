// Encounter lists on both home screens: live encounters first, then the person's
// own folders, then one group per campaign, then whatever is left.

interface Fileable {
  id: string
  campaign_id: string | null
  live: boolean
}

export interface EncounterFolder<T> {
  id: string
  name: string
  encounters: T[]
}

export interface GroupedEncounters<T> {
  live: T[]
  /** The person's own folders, including empty ones, so they can be filled. */
  folders: EncounterFolder<T>[]
  /** Campaign groups for encounters not filed in a folder. Empty ones are left out. */
  campaigns: EncounterFolder<T>[]
  loose: T[]
}

interface Options {
  campaigns: readonly { id: string; name: string }[]
  folders?: readonly { id: string; name: string }[]
  /** Folder id by encounter id. */
  filed?: Readonly<Record<string, string>>
  /** For a campaign that isn't in the list (one the person has left, say). */
  fallbackName?: string
}

export function groupEncounters<T extends Fileable>(encounters: readonly T[], options: Options): GroupedEncounters<T> {
  const { campaigns, folders = [], filed = {}, fallbackName = 'Campaign' } = options
  const live = encounters.filter((e) => e.live)
  const rest = encounters.filter((e) => !e.live)
  const folderIds = new Set(folders.map((f) => f.id))
  const inFolder = (e: T) => folderIds.has(filed[e.id] ?? '')

  const own = folders.map((f) => ({ id: f.id, name: f.name, encounters: rest.filter((e) => filed[e.id] === f.id) }))
  const unfiled = rest.filter((e) => !inFolder(e))

  const known = new Map(campaigns.map((c) => [c.id, c.name]))
  const order = [...campaigns.map((c) => c.id), ...unfiled.flatMap((e) => (e.campaign_id && !known.has(e.campaign_id) ? [e.campaign_id] : []))]
  const grouped = [...new Set(order)].flatMap((id): EncounterFolder<T>[] => {
    const inside = unfiled.filter((e) => e.campaign_id === id)
    return inside.length ? [{ id, name: known.get(id) ?? fallbackName, encounters: inside }] : []
  })

  return { live, folders: own, campaigns: grouped, loose: unfiled.filter((e) => !e.campaign_id) }
}
