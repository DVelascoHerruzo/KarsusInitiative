import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronUp, Dices, Expand, Eye, Heart, Plus, Shield, Shrink, Sword, User } from 'lucide-react'
import { HealthTag, HpBar, StatusPill, Token } from '@/components/ui/tokens'
import { healthBand, nextUp, sortByInitiative } from '@/lib/combat'
import { hasCondition } from '@/lib/conditions'
import { cn } from '@/lib/cn'
import { useDisplayScreen } from '@/lib/theme'
import type { Encounter, SharedCreature, SharedEncounter } from '@/lib/types'

/** Client-side redaction matching redact() in the API, used by the offline demo. */
export function toSharedEncounter(e: Encounter): SharedEncounter {
  const visible = e.creatures.filter((c) => !c.hidden)
  const active = visible.some((c) => c.id === e.active_creature_id) ? e.active_creature_id : null
  return {
    title: e.title,
    description: e.description,
    background_url: e.background_url,
    round: e.round,
    active_creature_id: active,
    hidden_turn: e.active_creature_id !== null && active === null,
    updated_at: e.updated_at,
    creatures: sortByInitiative(visible).map((c) => ({
      id: c.id,
      name: c.name,
      is_player: c.is_player,
      initiative: c.initiative,
      image_url: c.image_url,
      conditions: c.conditions,
      current_hp: c.is_player ? c.current_hp : null,
      max_hp: c.is_player ? c.max_hp : null,
      temp_hp: c.is_player ? c.temp_hp : 0,
      armor_class: c.is_player ? c.armor_class : null,
      health: healthBand(c.current_hp, c.max_hp),
    })),
  }
}

function useFullscreen() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const sync = () => setOn(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  const toggle = () => (on ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})
  return [on, toggle] as const
}

/** Keeps a TV or tablet from dimming mid-fight. Silently unsupported on older browsers. */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const request = () => {
      if (document.visibilityState === 'visible' && 'wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(
          (l) => (lock = l),
          () => {},
        )
      }
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      document.removeEventListener('visibilitychange', request)
      void lock?.release()
    }
  }, [])
}

interface DisplayViewProps {
  encounter: SharedEncounter
  /** The signed-in player's own creatures: marked, and their HP and conditions open for editing. */
  mine?: readonly string[]
  onHp?: (creature: SharedCreature) => void
  onConditions?: (creature: SharedCreature) => void
  back?: { to: string; label: string }
  /** The small italic tag at the top right. */
  label?: string
}

/**
 * The display window: the acting creature full-height on the left, the
 * initiative order on the right, round and turn across the top. Monsters show
 * how hurt they look, never their numbers.
 */
export function DisplayView({ encounter: e, mine = [], onHp, onConditions, back, label = 'Display Window · Live sync' }: DisplayViewProps) {
  const [fullscreen, toggleFullscreen] = useFullscreen()
  useWakeLock()
  useDisplayScreen()

  const sorted = e.creatures
  const activeIdx = sorted.findIndex((c) => c.id === e.active_creature_id)
  const active = activeIdx >= 0 ? sorted[activeIdx]! : null
  const next = nextUp(sorted, e.active_creature_id)
  const standing = sorted.filter((c) => !hasCondition(c.conditions, 'dead')).length

  return (
    <div className="relative flex min-h-screen flex-col bg-dnd-black lg:h-screen lg:overflow-hidden">
      {e.background_url ? (
        <div className="pointer-events-none absolute inset-0">
          <img src={e.background_url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/85" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-dnd-dark to-dnd-black" />
      )}

      <p className="sr-only" aria-live="assertive">
        {active ? `Round ${e.round}. ${active.name}’s turn.` : e.hidden_turn ? 'Something unseen is acting.' : 'Waiting for combat to start.'}
      </p>

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-dnd-border/40 bg-black/50 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="min-w-0 flex-1">
          {back && (
            <Link to={back.to} className="mb-0.5 inline-flex items-center gap-1 font-body text-[11px] tracking-widest text-dnd-muted uppercase hover:text-dnd-parchment">
              <ChevronLeft className="h-3.5 w-3.5" /> {back.label}
            </Link>
          )}
          <h1 className="truncate font-display text-lg tracking-widest text-dnd-gold sm:text-2xl">{e.title}</h1>
          {e.description && <p className="truncate font-ui text-xs text-dnd-muted italic">{e.description}</p>}
        </div>

        <div className="flex items-center gap-8">
          <div className="text-center">
            <p className="font-body text-[10px] tracking-widest text-dnd-muted">ROUND</p>
            <p className="font-display text-3xl leading-none text-dnd-amber">{e.round}</p>
          </div>
          <div className="text-center">
            <p className="font-body text-[10px] tracking-widest text-dnd-muted">TURN</p>
            <p className="font-display text-3xl leading-none text-dnd-parchment">
              {active ? activeIdx + 1 : '–'}
              <span className="text-sm text-dnd-muted">/{sorted.length}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <p className="hidden font-ui text-[11px] text-dnd-muted/50 italic sm:block">{label}</p>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            title={fullscreen ? 'Exit full screen' : 'Full screen'}
            className="rounded-lg p-2 text-dnd-muted transition-colors hover:bg-dnd-surface/60 hover:text-dnd-parchment"
          >
            {fullscreen ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* ── Main split ────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* Left: the acting creature */}
        <div className="relative h-[55vh] shrink-0 overflow-hidden lg:h-auto lg:w-1/3">
          <AnimatePresence mode="wait">
            {active ? (
              <ActiveCard key={active.id} creature={active} own={mine.includes(active.id)} />
            ) : (
              <motion.div key={e.hidden_turn ? 'unseen' : 'waiting'} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {e.hidden_turn ? <Unseen /> : <Waiting />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden w-px self-stretch bg-gradient-to-b from-transparent via-dnd-border/50 to-transparent lg:block" />

        {/* Right: initiative order */}
        <div className="flex flex-1 flex-col bg-black/30 backdrop-blur-sm lg:min-h-0">
          <div className="flex items-center gap-2 border-b border-dnd-border/30 px-5 py-4">
            <span className="font-body text-xs tracking-[0.3em] text-dnd-jade uppercase">Initiative Order</span>
            <span className="ml-auto font-ui text-xs text-dnd-muted">{standing} active</span>
          </div>

          <ol className="flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-label="Turn order">
            {sorted.length === 0 ? (
              <li className="mt-8 text-center font-ui text-sm text-dnd-muted italic">No creatures</li>
            ) : (
              sorted.map((c, i) => (
                <InitiativeRow
                  key={c.id}
                  creature={c}
                  rank={i + 1}
                  isActive={c.id === active?.id}
                  own={mine.includes(c.id)}
                  onHp={onHp && (() => onHp(c))}
                  onConditions={onConditions && (() => onConditions(c))}
                />
              ))
            )}
          </ol>

          {next && (
            <div className="border-t border-dnd-border/30 bg-black/20 px-5 py-3">
              <p className="mb-2 font-body text-[10px] tracking-widest text-dnd-muted uppercase">Up Next</p>
              <div className="flex items-center gap-2">
                <Token name={next.name} src={next.image_url} isPlayer={next.is_player} size={32} />
                <div>
                  <p className="font-body text-sm text-dnd-parchment">{next.name}</p>
                  <p className="text-[10px] text-dnd-muted">Initiative {next.initiative}</p>
                </div>
                <ChevronUp className="ml-auto h-4 w-4 text-dnd-muted" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ActiveCard({ creature: c, own }: { creature: SharedCreature; own: boolean }) {
  const dead = hasCondition(c.conditions, 'dead')
  const statuses = c.conditions.filter((x) => x.key !== 'dead')
  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      {c.image_url ? (
        <img src={c.image_url} alt="" className={cn('absolute inset-0 h-full w-full object-cover object-top', dead && 'grayscale')} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-dnd-dark">
          {c.is_player ? <User className="h-32 w-32 text-dnd-jade/20" /> : <Sword className="h-32 w-32 text-dnd-jade/20" />}
        </div>
      )}

      <div className="absolute top-0 bottom-0 left-0 w-1 bg-dnd-jade shadow-glow-jade" />

      <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-6 pt-32 pb-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-dnd-jade" />
          <span className="font-body text-[10px] tracking-[0.35em] text-dnd-jade uppercase">{own ? 'Your Turn' : 'Active Turn'}</span>
          <div className="h-2 w-2 animate-pulse rounded-full bg-dnd-jade" />
        </div>

        <h2 className="font-display text-3xl leading-tight text-dnd-parchment lg:text-4xl" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.9)' }}>
          {c.name}
        </h2>
        {c.is_player && <span className="font-body text-xs tracking-widest text-dnd-jade">{own ? 'YOUR CHARACTER' : 'PLAYER CHARACTER'}</span>}

        <div className="mt-3 flex flex-wrap items-center gap-4">
          {c.max_hp !== null ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-red-400" />
                <span className="font-body text-base text-dnd-parchment">
                  {c.current_hp}
                  <span className="text-sm text-dnd-muted">/{c.max_hp}</span>
                  {c.temp_hp > 0 && <span className="ml-1 text-sm text-sky-300">+{c.temp_hp}</span>}
                </span>
              </div>
              <HpBar current={c.current_hp} max={c.max_hp} temp={c.temp_hp} className="h-2 w-32" />
            </div>
          ) : (
            c.health && !dead && <HealthTag band={c.health} className="text-sm" />
          )}
          {c.armor_class !== null && (
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-sky-400" />
              <span className="font-body text-base text-dnd-parchment">AC {c.armor_class}</span>
            </div>
          )}
          {statuses.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {statuses.map((x) => (
                <StatusPill key={x.key} condition={x} size="md" />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function Waiting() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-dnd-dark/70 px-8 text-center">
      <Dices className="h-14 w-14 text-dnd-jade/60" />
      <p className="font-display text-3xl tracking-widest text-dnd-gold">Roll for Initiative</p>
      <p className="max-w-xs font-ui text-dnd-muted italic">The fight starts when your DM begins combat. This screen updates on its own.</p>
    </div>
  )
}

/** A hidden creature is acting. Players see that the fight moves on, not who moves. */
function Unseen() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-dnd-dark/80 px-8 text-center">
      <Eye className="h-14 w-14 text-purple-300/70" />
      <p className="font-display text-3xl tracking-widest text-dnd-parchment">Something Stirs</p>
      <p className="max-w-xs font-ui text-dnd-muted italic">An unseen creature is taking its turn.</p>
    </div>
  )
}

interface InitiativeRowProps {
  creature: SharedCreature
  rank: number
  isActive: boolean
  own: boolean
  onHp?: () => void
  onConditions?: () => void
}

function InitiativeRow({ creature: c, rank, isActive, own, onHp, onConditions }: InitiativeRowProps) {
  const dead = hasCondition(c.conditions, 'dead')
  const statuses = c.conditions.filter((x) => x.key !== 'dead')
  const pct = c.max_hp && c.current_hp !== null ? Math.max(0, Math.min(100, (c.current_hp / c.max_hp) * 100)) : null
  const editable = own && Boolean(onHp)

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      aria-current={isActive ? 'step' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-300',
        isActive ? 'border-dnd-gold/50 bg-dnd-surface/30 shadow-glow-gold' : 'border-dnd-border/40 bg-dnd-dark/60 opacity-75 hover:opacity-100',
        own && !isActive && 'border-dnd-jade/40 opacity-100',
        dead && 'opacity-30 grayscale',
      )}
    >
      <span className={cn('w-6 shrink-0 text-center font-body text-sm', isActive ? 'font-bold text-dnd-gold' : 'text-dnd-muted')}>{rank}</span>

      <Token name={c.name} src={c.image_url} isPlayer={c.is_player} size={isActive ? 48 : 40} active={isActive} initiative={c.initiative} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('truncate font-body text-sm', isActive ? 'font-semibold text-dnd-gold' : 'text-dnd-parchment')}>{c.name}</span>
          {own && <span className="shrink-0 rounded border border-dnd-jade/50 px-1.5 text-[10px] tracking-widest text-dnd-jade uppercase">you</span>}
          {statuses.map((x) => (
            <StatusPill key={x.key} condition={x} />
          ))}
          {editable && onConditions && (
            <button
              type="button"
              onClick={onConditions}
              aria-label={`Conditions for ${c.name}`}
              className="inline-flex h-5 items-center gap-0.5 rounded border border-dnd-border/50 px-1.5 text-[10px] text-dnd-muted hover:text-dnd-parchment"
            >
              <Plus className="h-3 w-3" /> condition
            </button>
          )}
        </div>
        {pct !== null &&
          (editable ? (
            <button
              type="button"
              onClick={onHp}
              aria-label={`${c.name}: ${c.current_hp} of ${c.max_hp} hit points. Change HP`}
              className="mt-1 flex w-full items-center gap-2 rounded px-1 py-0.5 hover:bg-dnd-surface/60"
            >
              <HpBar current={c.current_hp} max={c.max_hp} temp={c.temp_hp} className="h-1.5 flex-1" />
              <span className="text-[11px] whitespace-nowrap text-dnd-parchment">
                {c.current_hp}/{c.max_hp}
                {c.temp_hp > 0 && <span className="text-sky-300"> +{c.temp_hp}</span>}
              </span>
            </button>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <HpBar current={c.current_hp} max={c.max_hp} temp={c.temp_hp} className="h-1 flex-1" />
              <span className="text-[10px] whitespace-nowrap text-dnd-muted">
                {c.current_hp}/{c.max_hp}
              </span>
            </div>
          ))}
      </div>

      {pct === null && c.health && !dead && <HealthTag band={c.health} className="shrink-0" />}
      {isActive && <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-dnd-gold" />}
    </motion.li>
  )
}
