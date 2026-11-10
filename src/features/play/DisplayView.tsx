import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react'
import { useDisplay } from '@/lib/display'
import { ChevronLeft, ChevronUp, Dices, Expand, Heart, Plus, Shield, Shrink, Sword, Undo2, User } from 'lucide-react'
import { HealthTag, HpBar, StatusPill, Token } from '@/components/ui/tokens'
import { healthBand, nextUp, playerTurn, turnDirection } from '@/lib/combat'
import { hasCondition } from '@/lib/conditions'
import { cn } from '@/lib/cn'
import type { CharacterSheet, Creature, Encounter, SharedCreature, SharedEncounter } from '@/lib/types'
import { useHotkeys } from '@/lib/useHotkeys'
import { CharacterSheetView } from '@/features/characters/CharacterSheetView'

/** Client-side redaction matching redact() in the API, used by the offline demo. */
export function toSharedEncounter(e: Encounter): SharedEncounter {
  const turn = playerTurn(e.creatures, e.active_creature_id, e.round)
  return {
    title: e.title,
    description: e.description,
    background_url: e.background_url,
    round: turn.round,
    active_creature_id: turn.activeId,
    updated_at: e.updated_at,
    creatures: turn.creatures.map((c) => ({
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
  /** Those creatures in full, shown with their sheets under the turn order. */
  characters?: readonly Creature[]
  onHp?: (creature: SharedCreature) => void
  onConditions?: (creature: SharedCreature) => void
  /** Spends or recovers one of the player's own spell slots. */
  onSlots?: (character: Creature, slots: Pick<CharacterSheet, 'spell_slots' | 'pact_slots'>) => void
  back?: { to: string; label: string }
  /** The small italic tag at the top right. */
  label?: string
}

/**
 * The display window: the acting creature full-height on the left, the
 * initiative order on the right, round and turn across the top. Monsters show
 * how hurt they look, never their numbers.
 */
/** The player screen. Its animations follow the Reduce motion display setting. */
export function DisplayView(props: DisplayViewProps) {
  const [{ calm }] = useDisplay()
  return (
    <MotionConfig reducedMotion={calm ? 'always' : 'never'}>
      <DisplayScreen {...props} />
    </MotionConfig>
  )
}

function DisplayScreen({ encounter: e, mine = [], characters = [], onHp, onConditions, onSlots, back, label = 'Player View · Live sync' }: DisplayViewProps) {
  const [fullscreen, toggleFullscreen] = useFullscreen()
  useWakeLock()

  const sorted = e.creatures
  const activeIdx = sorted.findIndex((c) => c.id === e.active_creature_id)
  const active = activeIdx >= 0 ? sorted[activeIdx]! : null
  const next = nextUp(sorted, e.active_creature_id)
  const standing = sorted.filter((c) => !hasCondition(c.conditions, 'dead')).length

  // Anyone can look at another creature as if it were its turn: clicking a row or
  // the arrow keys. A new turn brings the stage back to whoever's acting.
  const [viewing, setViewing] = useState<{ id: string; turn: string } | null>(null)
  const turnKey = `${e.round}:${e.active_creature_id}`
  const viewedIdx = viewing && viewing.turn === turnKey ? sorted.findIndex((c) => c.id === viewing.id) : -1
  const shownIdx = viewedIdx >= 0 ? viewedIdx : activeIdx
  const shown = shownIdx >= 0 ? sorted[shownIdx]! : null
  const look = (id: string) => setViewing(id === active?.id ? null : { id, turn: turnKey })
  const step = (by: 1 | -1) => {
    if (sorted.length === 0) return
    const from = shownIdx >= 0 ? shownIdx : by > 0 ? -1 : sorted.length
    look(sorted[Math.max(0, Math.min(sorted.length - 1, from + by))]!.id)
  }
  useHotkeys({ arrowdown: () => step(1), j: () => step(1), arrowup: () => step(-1), k: () => step(-1), escape: () => setViewing(null) })

  // Which way the stage moved, remembered from the previous render, so moving back slides the other way.
  const position = { round: e.round, index: shownIdx }
  const [last, setLast] = useState(position)
  const [direction, setDirection] = useState<1 | -1>(1)
  if (last.round !== position.round || last.index !== position.index) {
    setLast(position)
    setDirection(turnDirection(last, position))
  }

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
        {active ? `Round ${e.round}. ${active.name}’s turn.` : 'Waiting for combat to start.'}
      </p>

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-dnd-border/40 bg-black/50 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="min-w-0 flex-1">
          {back && (
            <Link to={back.to} className="mb-0.5 flex max-w-full items-center gap-1 font-body text-[0.6875rem] tracking-widest text-dnd-muted uppercase hover:text-dnd-parchment">
              <ChevronLeft className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{back.label}</span>
            </Link>
          )}
          <h1 className="truncate font-display text-lg tracking-widest text-dnd-gold sm:text-2xl">{e.title}</h1>
          {e.description && <p className="truncate font-ui text-xs text-dnd-muted italic">{e.description}</p>}
        </div>

        <div className="flex items-center gap-8">
          <div className="text-center">
            <p className="font-body text-[0.625rem] tracking-widest text-dnd-muted">ROUND</p>
            <p className="font-display text-3xl leading-none text-dnd-amber">{e.round}</p>
          </div>
          <div className="text-center">
            <p className="font-body text-[0.625rem] tracking-widest text-dnd-muted">TURN</p>
            <p className="font-display text-3xl leading-none text-dnd-parchment">
              {active ? activeIdx + 1 : '–'}
              <span className="text-sm text-dnd-muted">/{sorted.length}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <p className="hidden font-ui text-[0.6875rem] text-dnd-muted/50 italic sm:block">{label}</p>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            title={fullscreen ? 'Leave full screen' : 'Fill the whole screen, for a TV or projector. The screen also stays awake.'}
            className="rounded-lg p-2 text-dnd-muted transition-colors hover:bg-dnd-surface/60 hover:text-dnd-parchment"
          >
            {fullscreen ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* ── Main split ────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* Left (on a phone, on top): the acting creature. A new turn slides the
            old card out to the left to reveal the next one beneath it. */}
        <div className="relative h-52 shrink-0 overflow-hidden sm:h-60 lg:h-auto lg:w-1/3">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={shown?.id ?? 'waiting'}
              className="absolute inset-0"
              custom={direction}
              variants={SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.5, ease: [0.65, 0, 0.35, 1] }}
            >
              {shown ? (
                <ActiveCard creature={shown} own={mine.includes(shown.id)} acting={shown.id === active?.id} onBack={active ? () => setViewing(null) : undefined} />
              ) : (
                <Waiting />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="hidden w-px self-stretch bg-gradient-to-b from-transparent via-dnd-border/50 to-transparent lg:block" />

        {/* Right: initiative order */}
        <div className="flex flex-1 flex-col bg-black/30 backdrop-blur-sm lg:min-h-0">
          <div className="flex items-center gap-2 border-b border-dnd-border/30 px-5 py-4">
            <span className="font-body text-xs tracking-[0.3em] text-dnd-jade uppercase">Initiative Order</span>
            <span className="ml-auto font-ui text-xs text-dnd-muted">{standing} active</span>
          </div>

          <div className="flex-1 overflow-y-auto">
          <p className="sr-only">Select a creature, or use the up and down arrow keys, to look at it. Escape goes back to whoever’s acting.</p>
          <ol className="space-y-2 px-3 py-3" aria-label="Turn order">
            {sorted.length === 0 ? (
              <li className="mt-8 text-center font-ui text-sm text-dnd-muted italic">No creatures</li>
            ) : (
              sorted.map((c, i) => (
                <InitiativeRow
                  key={c.id}
                  creature={c}
                  rank={i + 1}
                  isActive={c.id === active?.id}
                  isViewed={c.id === shown?.id && c.id !== active?.id}
                  onLook={() => look(c.id)}
                  own={mine.includes(c.id)}
                  onHp={onHp && (() => onHp(c))}
                  onConditions={onConditions && (() => onConditions(c))}
                />
              ))
            )}
          </ol>

          {characters.map((ch) => {
            const live = sorted.find((x) => x.id === ch.id)
            return (
              <section key={ch.id} aria-label={`Your character, ${ch.name}`} className="mx-3 mb-4 rounded-xl border border-dnd-jade/40 bg-dnd-dark/80 p-4">
                <CharacterSheetView
                  character={{ ...ch, ...(live && { current_hp: live.current_hp, temp_hp: live.temp_hp, conditions: live.conditions }) }}
                  onSlots={onSlots && ((slots) => onSlots(ch, slots))}
                  actions={
                    live && (
                      <>
                        {onHp && ch.max_hp !== null && (
                          <button type="button" className="dnd-button-primary px-4 py-2 text-sm" onClick={() => onHp(live)}>
                            <Heart className="h-4 w-4" /> {live.current_hp}/{live.max_hp} HP
                          </button>
                        )}
                        {onConditions && (
                          <button type="button" className="dnd-button-secondary px-4 py-2 text-sm" onClick={() => onConditions(live)}>
                            <Plus className="h-4 w-4" /> Conditions
                          </button>
                        )}
                      </>
                    )
                  }
                />
              </section>
            )
          })}
          </div>

          {next && (
            <div className="border-t border-dnd-border/30 bg-black/20 px-5 py-3">
              <p className="mb-2 font-body text-[0.625rem] tracking-widest text-dnd-muted uppercase">Up Next</p>
              <div className="flex items-center gap-2">
                <Token name={next.name} src={next.image_url} isPlayer={next.is_player} size={32} />
                <div>
                  <p className="font-body text-sm text-dnd-parchment">{next.name}</p>
                  <p className="text-[0.625rem] text-dnd-muted">Initiative {next.initiative}</p>
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

/**
 * Forward: the old card slides out to the left, uncovering the next one, which
 * brightens as it's revealed. Back a turn: the returning card slides in from the
 * left over the current one, which dims beneath it.
 */
const SLIDE: Variants = {
  enter: (direction: 1 | -1) => (direction > 0 ? { x: 0, zIndex: 0, filter: 'brightness(0.55)' } : { x: '-100%', zIndex: 2, filter: 'brightness(1)' }),
  center: { x: 0, zIndex: 1, filter: 'brightness(1)' },
  exit: (direction: 1 | -1) => (direction > 0 ? { x: '-100%', zIndex: 2 } : { x: 0, zIndex: 0, filter: 'brightness(0.55)' }),
}

/** Full height with the stats over the portrait on wide screens; on a phone, a short card with the stats left and the portrait right. */
interface ActiveCardProps {
  creature: SharedCreature
  own: boolean
  /** False while a player is looking at someone other than whoever's acting. */
  acting: boolean
  onBack?: () => void
}

function ActiveCard({ creature: c, own, acting, onBack }: ActiveCardProps) {
  const dead = hasCondition(c.conditions, 'dead')
  const statuses = c.conditions.filter((x) => x.key !== 'dead')
  return (
    <div className="absolute inset-0 bg-dnd-dark">
      <div className="absolute inset-y-0 right-0 w-[42%] lg:inset-0 lg:w-full">
        {c.image_url ? (
          <img src={c.image_url} alt="" className={cn('h-full w-full object-cover object-top', dead && 'grayscale')} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-dnd-surface/40">
            {c.is_player ? <User className="h-16 w-16 text-dnd-jade/20 lg:h-32 lg:w-32" /> : <Sword className="h-16 w-16 text-dnd-jade/20 lg:h-32 lg:w-32" />}
          </div>
        )}
        {/* On a phone, the portrait's left edge fades into the stats. */}
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-dnd-dark to-transparent lg:hidden" />
      </div>

      <div className="absolute top-0 bottom-0 left-0 z-10 w-1 bg-dnd-jade shadow-glow-jade" />

      <div className="absolute inset-y-0 left-0 flex w-[58%] flex-col justify-center py-3 pr-2 pl-5 lg:inset-x-0 lg:top-auto lg:w-full lg:justify-end lg:bg-gradient-to-t lg:from-black/95 lg:via-black/70 lg:to-transparent lg:px-6 lg:pt-32 lg:pb-6">
        {acting ? (
          <div className="mb-2 flex items-center gap-2 lg:mb-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-dnd-jade" />
            <span className="font-body text-[0.625rem] tracking-[0.35em] text-dnd-jade uppercase">{own ? 'Your Turn' : 'Active Turn'}</span>
            <div className="h-2 w-2 animate-pulse rounded-full bg-dnd-jade" />
          </div>
        ) : (
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 lg:mb-3">
            <span className="font-body text-[0.625rem] tracking-[0.35em] text-dnd-muted uppercase">Looking at</span>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded border border-dnd-gold/50 px-1.5 py-0.5 font-body text-[0.625rem] tracking-widest text-dnd-gold uppercase hover:bg-dnd-gold/10"
              >
                <Undo2 className="h-3 w-3" /> Back to the turn
              </button>
            )}
          </div>
        )}

        <h2 className="line-clamp-3 font-display text-xl leading-tight wrap-anywhere text-dnd-parchment sm:text-3xl lg:text-4xl" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.9)' }}>
          {c.name}
        </h2>
        {c.is_player && <span className="font-body text-[0.625rem] tracking-widest text-dnd-jade lg:text-xs">{own ? 'YOUR CHARACTER' : 'PLAYER CHARACTER'}</span>}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 lg:mt-3">
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
              <HpBar current={c.current_hp} max={c.max_hp} temp={c.temp_hp} className="h-2 w-28 lg:w-32" />
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
    </div>
  )
}

function Waiting() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-dnd-dark px-8 text-center lg:gap-4">
      <Dices className="h-10 w-10 text-dnd-jade/60 lg:h-14 lg:w-14" />
      <p className="font-display text-2xl tracking-widest text-dnd-gold lg:text-3xl">Roll for Initiative</p>
      <p className="max-w-xs font-ui text-sm text-dnd-muted italic lg:text-base">The fight starts when your DM begins combat. This screen updates on its own.</p>
    </div>
  )
}

interface InitiativeRowProps {
  creature: SharedCreature
  rank: number
  isActive: boolean
  /** The one this viewer is looking at, when it isn't the acting creature. */
  isViewed: boolean
  onLook: () => void
  own: boolean
  onHp?: () => void
  onConditions?: () => void
}

function InitiativeRow({ creature: c, rank, isActive, isViewed, onLook, own, onHp, onConditions }: InitiativeRowProps) {
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
      onClick={onLook}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-300',
        isActive ? 'border-dnd-gold/50 bg-dnd-surface/30 shadow-glow-gold' : 'border-dnd-border/40 bg-dnd-dark/60 opacity-75 hover:opacity-100',
        own && !isActive && 'border-dnd-jade/40 opacity-100',
        isViewed && 'border-dnd-gold/30 opacity-100 shadow-[0_0_14px_rgb(var(--color-heading-rgb)/0.3)]',
        dead && 'opacity-30 grayscale',
      )}
    >
      <span className={cn('w-6 shrink-0 text-center font-body text-sm', isActive ? 'font-bold text-dnd-gold' : 'text-dnd-muted')}>{rank}</span>

      <Token name={c.name} src={c.image_url} isPlayer={c.is_player} size={isActive ? 48 : 40} active={isActive} initiative={c.initiative} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onLook()
            }}
            aria-pressed={isViewed || isActive}
            aria-label={`Look at ${c.name}`}
            title="Look at this creature on the big card, as if it were its turn. Arrow keys move between creatures; Escape goes back."
            className={cn('truncate text-left font-body text-sm', isActive ? 'font-semibold text-dnd-gold' : isViewed ? 'text-dnd-amber' : 'text-dnd-parchment')}
          >
            {c.name}
          </button>
          {own && <span className="shrink-0 rounded border border-dnd-jade/50 px-1.5 text-[0.625rem] tracking-widest text-dnd-jade uppercase">you</span>}
          {statuses.map((x) => (
            <StatusPill key={x.key} condition={x} />
          ))}
          {editable && onConditions && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onConditions()
              }}
              aria-label={`Conditions for ${c.name}`}
              className="inline-flex h-5 items-center gap-0.5 rounded border border-dnd-border/50 px-1.5 text-[0.625rem] text-dnd-muted hover:text-dnd-parchment"
            >
              <Plus className="h-3 w-3" /> condition
            </button>
          )}
        </div>
        {pct !== null &&
          (editable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onHp?.()
              }}
              aria-label={`${c.name}: ${c.current_hp} of ${c.max_hp} hit points. Change HP`}
              className="mt-1 flex w-full items-center gap-2 rounded px-1 py-0.5 hover:bg-dnd-surface/60"
            >
              <HpBar current={c.current_hp} max={c.max_hp} temp={c.temp_hp} className="h-1.5 flex-1" />
              <span className="text-[0.6875rem] whitespace-nowrap text-dnd-parchment">
                {c.current_hp}/{c.max_hp}
                {c.temp_hp > 0 && <span className="text-sky-300"> +{c.temp_hp}</span>}
              </span>
            </button>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <HpBar current={c.current_hp} max={c.max_hp} temp={c.temp_hp} className="h-1 flex-1" />
              <span className="text-[0.625rem] whitespace-nowrap text-dnd-muted">
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
