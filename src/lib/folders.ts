// Encounter lists on both home screens: live encounters first, then one folder per
// preset (a campaign, for players), then whatever isn't in a folder.

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
  folders: EncounterFolder<T>[]
  loose: T[]
}

/** `folders` gives the order and names; a folder nobody can name yet is still shown. Empty folders are left out. */
export function groupEncounters<T extends Fileable>(
  encounters: readonly T[],
  folders: readonly { id: string; name: string }[],
  fallbackName = 'Campaign',
): GroupedEncounters<T> {
  const live = encounters.filter((e) => e.live)
  const rest = encounters.filter((e) => !e.live)
  const known = new Map(folders.map((f) => [f.id, f.name]))
  const order = [...folders.map((f) => f.id), ...rest.flatMap((e) => (e.campaign_id && !known.has(e.campaign_id) ? [e.campaign_id] : []))]
  const grouped = [...new Set(order)].flatMap((id): EncounterFolder<T>[] => {
    const inside = rest.filter((e) => e.campaign_id === id)
    return inside.length ? [{ id, name: known.get(id) ?? fallbackName, encounters: inside }] : []
  })
  return { live, folders: grouped, loose: rest.filter((e) => !e.campaign_id) }
}
