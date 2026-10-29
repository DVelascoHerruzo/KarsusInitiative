// The data contract shared by the browser and the API (api/src imports this file).

export type Condition = {
  /** A key from CONDITIONS, or `custom:<slug>` for free-text effects like Bless. */
  key: string
  label?: string
  /** Rounds remaining; ticks down at the end of the creature's turn. null = until removed. */
  rounds: number | null
}

/** A creature belongs to exactly one encounter or one preset. */
export interface Creature {
  id: string
  owner_id: string
  encounter_id: string | null
  preset_id: string | null
  name: string
  is_player: boolean
  initiative: number
  initiative_bonus: number
  max_hp: number | null
  current_hp: number | null
  temp_hp: number
  armor_class: number | null
  conditions: Condition[]
  notes: string | null
  image_url: string | null
  created_at: string
}

/** The fields a client may set on a creature; everything else is assigned by the server. */
export type CreatureFields = Omit<Creature, 'id' | 'owner_id' | 'encounter_id' | 'preset_id' | 'created_at'>

/** What the add-creature form produces. Missing fields take the server defaults. */
export type NewCreature = Pick<CreatureFields, 'name'> & Partial<Omit<CreatureFields, 'name'>>

export type CreaturePatch = Partial<CreatureFields>

export interface EncounterRow {
  id: string
  owner_id: string
  title: string
  description: string | null
  background_url: string | null
  round: number
  active_creature_id: string | null
  /** 128 random bits; knowing the token is what grants access to the player view. */
  share_token: string
  share_enabled: boolean
  created_at: string
  updated_at: string
}

export type Encounter = EncounterRow & { creatures: Creature[] }
export type EncounterPatch = Partial<Pick<EncounterRow, 'title' | 'description' | 'background_url' | 'round' | 'active_creature_id' | 'share_enabled'>>
export type NewEncounter = Pick<EncounterRow, 'title' | 'description' | 'background_url'>

export interface PresetRow {
  id: string
  owner_id: string
  name: string
  description: string | null
  background_url: string | null
  created_at: string
  updated_at: string
}

export type Preset = PresetRow & { creatures: Creature[] }
export type PresetFields = Pick<PresetRow, 'name' | 'description' | 'background_url'>

/** Just enough of each creature for the dashboard's lineup avatars. */
export type CreatureSummary = Pick<Creature, 'id' | 'name' | 'image_url' | 'is_player'>

export type EncounterSummary = Pick<EncounterRow, 'id' | 'title' | 'description' | 'background_url' | 'round' | 'active_creature_id' | 'updated_at'> & {
  creatures: CreatureSummary[]
}

export type PresetSummary = Pick<PresetRow, 'id' | 'name' | 'description' | 'background_url' | 'updated_at'> & {
  creatures: CreatureSummary[]
}

export type HealthBand = 'healthy' | 'wounded' | 'bloodied' | 'critical' | 'down'

/** The redacted shape the player view receives: no notes, and monsters show a health band only. */
export interface SharedCreature {
  id: string
  name: string
  is_player: boolean
  initiative: number
  image_url: string | null
  conditions: Condition[]
  current_hp: number | null
  max_hp: number | null
  temp_hp: number
  armor_class: number | null
  health: HealthBand | null
}

export interface SharedEncounter {
  title: string
  description: string | null
  background_url: string | null
  round: number
  active_creature_id: string | null
  updated_at: string
  creatures: SharedCreature[]
}

/** The signed-in account, as the API reports it. */
export interface User {
  id: string
  email: string
  username: string
}
