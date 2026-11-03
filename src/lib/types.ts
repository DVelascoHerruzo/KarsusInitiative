// The data contract shared by the browser and the API (api/src imports this file).

export type Condition = {
  /** A key from CONDITIONS, or `custom:<slug>` for free-text effects like Bless. */
  key: string
  label?: string
  /** Rounds remaining; ticks down at the end of the creature's turn. null = until removed. */
  rounds: number | null
}

// ─── Character sheets ────────────────────────────────────────────────────────

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export type Skill =
  | 'acrobatics'
  | 'animal-handling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleight-of-hand'
  | 'stealth'
  | 'survival'

export type Proficiency = 'proficient' | 'expertise'

export interface ClassLevel {
  name: string
  subclass: string | null
  level: number
}

export interface SpellSlots {
  /** Spell level, 1–9. */
  level: number
  max: number
  used: number
}

export interface Item {
  name: string
  quantity: number
  equipped: boolean
}

/**
 * The part of a player character that lives between fights. Bonuses (saves,
 * skills, proficiency, spell DC) are derived from it in src/lib/sheet.ts.
 */
export interface CharacterSheet {
  species: string | null
  background: string | null
  classes: ClassLevel[]
  speed: number | null
  abilities: Record<Ability, number>
  saves: Ability[]
  skills: Partial<Record<Skill, Proficiency>>
  spellcasting_ability: Ability | null
  spell_slots: SpellSlots[]
  /** Warlock slots, which come back on a short rest. */
  pact_slots: SpellSlots | null
  inventory: Item[]
  /** The player's own notes. The DM can read them; other players can't. */
  player_notes: string | null
  /** The D&D Beyond character it was imported from. */
  source_url: string | null
}

export type Role = 'player' | 'dm'

/** Someone invited to a campaign or encounter. The owner isn't listed. */
export interface Member {
  user_id: string
  username: string
  role: Role
  joined_at: string
}

/** Invite link tokens, one per role; null while that link is switched off. */
export interface Invites {
  player: string | null
  dm: string | null
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
  /** Players don't see hidden creatures until the DM reveals them. */
  hidden: boolean
  /** The account playing this character, once a player has claimed it. */
  player_id: string | null
  /** In an encounter launched from a campaign: the campaign character this is a copy of. */
  character_id: string | null
  sheet: CharacterSheet | null
  created_at: string
}

/** The fields a client may set on a creature; everything else is assigned by the server. */
export type CreatureFields = Omit<Creature, 'id' | 'owner_id' | 'encounter_id' | 'preset_id' | 'player_id' | 'character_id' | 'created_at'>

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
  /** The campaign (preset) it was launched from; that campaign's players see it unless it's hidden. */
  campaign_id: string | null
  hidden: boolean
  members: Member[]
  invites: Invites
  created_at: string
  updated_at: string
}

export type Encounter = EncounterRow & { creatures: Creature[] }
export type EncounterPatch = Partial<
  Pick<EncounterRow, 'title' | 'description' | 'background_url' | 'round' | 'active_creature_id' | 'share_enabled' | 'hidden'>
>
export type NewEncounter = Pick<EncounterRow, 'title' | 'description' | 'background_url'>

export interface PresetRow {
  id: string
  owner_id: string
  name: string
  description: string | null
  background_url: string | null
  /** Hidden presets are closed to their players, and so are the encounters launched from them. */
  hidden: boolean
  members: Member[]
  invites: Invites
  created_at: string
  updated_at: string
}

/** A preset with players in it is a campaign. */
export type Preset = PresetRow & { creatures: Creature[] }
export type PresetFields = Pick<PresetRow, 'name' | 'description' | 'background_url'>
export type PresetPatch = Partial<PresetFields & Pick<PresetRow, 'hidden'>>

/** Just enough of each creature for the dashboard's lineup avatars. */
export type CreatureSummary = Pick<Creature, 'id' | 'name' | 'image_url' | 'is_player'>

export type EncounterSummary = Pick<
  EncounterRow,
  'id' | 'owner_id' | 'title' | 'description' | 'background_url' | 'round' | 'active_creature_id' | 'campaign_id' | 'hidden' | 'updated_at'
> & {
  creatures: CreatureSummary[]
  members: number
}

export type PresetSummary = Pick<PresetRow, 'id' | 'owner_id' | 'name' | 'description' | 'background_url' | 'hidden' | 'updated_at'> & {
  creatures: CreatureSummary[]
  members: number
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
  /** null before combat starts, and while a hidden creature acts. */
  active_creature_id: string | null
  /** A hidden creature is acting: players see that something moves, not what. */
  hidden_turn: boolean
  updated_at: string
  creatures: SharedCreature[]
}

/** The player view for a signed-in player: the shared view, plus which creatures are theirs. */
export interface PlayerEncounter extends SharedEncounter {
  id: string
  /** Creatures this player controls; they may change their HP and conditions. */
  mine: string[]
  campaign: { id: string; name: string } | null
}

// ─── The player side ─────────────────────────────────────────────────────────

/** A party member as the other players see them. */
export interface PartyMember {
  id: string
  name: string
  image_url: string | null
  player_name: string | null
  classes: ClassLevel[]
  max_hp: number | null
  armor_class: number | null
}

export interface PlayerEncounterSummary {
  id: string
  title: string
  description: string | null
  background_url: string | null
  round: number
  started: boolean
  campaign_name: string | null
  character_name: string | null
  updated_at: string
}

/** A campaign as one of its players sees it. Monsters and hidden creatures never appear. */
export interface CampaignView {
  id: string
  name: string
  description: string | null
  background_url: string | null
  dm_name: string
  party: PartyMember[]
  /** The caller's own character, in full minus DM notes. */
  mine: Creature | null
  /** Characters nobody plays yet, which the caller could switch to. */
  available: PartyMember[]
  encounters: PlayerEncounterSummary[]
}

export interface CampaignSummary {
  id: string
  name: string
  description: string | null
  background_url: string | null
  dm_name: string
  character: CreatureSummary | null
  party: CreatureSummary[]
  updated_at: string
}

export interface PlayerHome {
  campaigns: CampaignSummary[]
  encounters: PlayerEncounterSummary[]
}

/** What an invite link shows before it's accepted. */
export interface InvitePreview {
  kind: 'encounter' | 'campaign'
  id: string
  name: string
  description: string | null
  background_url: string | null
  role: Role
  dm_name: string
  /** Player characters nobody has claimed yet, to pick from. */
  characters: PartyMember[]
  /** The caller's current standing, when they're already in. */
  current: Role | 'owner' | null
}

/** How a player picks a character: one the DM made, or a new one. */
export type CharacterChoice = { claim: string } | { create: NewCreature }

export type Mode = 'dm' | 'player'

/** The signed-in account, as the API reports it. */
export interface User {
  id: string
  email: string
  username: string
  /** Which side of the table they were on last. */
  mode: Mode
}
