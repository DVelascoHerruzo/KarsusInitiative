import { useEffect, useState } from 'react'
import { Dices, Expand, Shrink } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { ConditionChip, HealthTag, HpBar } from '@/components/ui/display'
import { Board, Cascade, CascadeRow, TurnWedge } from '@/features/combat/Cascade'
import { CommandLine, RoundBox, StageCaption } from '@/features/combat/StageParts'
import { TurnStage, useTurnDirection } from '@/features/combat/TurnStage'
import { healthBand, nextUp, sortByInitiative } from '@/lib/combat'
import { hasCondition } from '@/lib/conditions'
import { cn } from '@/lib/cn'
import type { Encounter, SharedCreature, SharedEncounter } from '@/lib/types'

/** Client-side redaction matching get_shared_encounter, used by the offline demo. */
export function toSharedEncounter(e: Encounter): SharedEncounter {
  return {
    title: e.title,
    description: e.description,
    background_url: e.background_url,
    round: e.round,
    active_creature_id: e.active_creature_id,
    updated_at: e.updated_at,
    creatures: sortByInitiative(e.creatures).map((c) => ({
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
        navigator.wakeLock.request('screen').then((l) => (lock = l), () => {})
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

export function PlayerBoard({ encounter: e }: { encounter: SharedEncounter }) {
  const [fullscreen, toggleFullscreen] = useFullscreen()
  useWakeLock()

  const ordered = e.creatures
  const activeIdx = ordered.findIndex((c) => c.id === e.active_creature_id)
  const active = activeIdx >= 0 ? ordered[activeIdx]! : null
  const next = active ? nextUp(ordered, active.id) : null
  const direction = useTurnDirection({ round: e.round, index: activeIdx })

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip lg:h-dvh lg:overflow-hidden">
      {e.background_url && (
        <img src={e.background_url} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-20 mix-blend-luminosity" />
      )}

      <p className="sr-only" aria-live="assertive">
        {active ? `Round ${e.round}. ${active.name}’s turn.` : 'Waiting for combat to start.'}
      </p>

      <header className="flex items-start gap-4 px-4 pt-4 pb-3 lg:absolute lg:top-0 lg:right-0 lg:z-10 lg:max-w-[46%] lg:px-8 lg:pt-7">
        <RoundBox round={e.round} className="lg:fixed lg:top-6 lg:left-6" />
        <div className="min-w-0 flex-1 lg:text-right">
          <h1 className="display line-clamp-2 text-xl text-vellum lg:truncate lg:text-2xl">{e.title}</h1>
          {e.description && <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{e.description}</p>}
        </div>
        <IconButton label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
          {fullscreen ? <Shrink /> : <Expand />}
        </IconButton>
      </header>

      <Board
        count={ordered.length}
        className="[--pad-bottom:132px] [--pad-top:128px] [--row-max:112px] [--row-min:52px] lg:h-dvh"
      >
        <TurnStage creature={active} direction={direction} idle={<Waiting />} caption={(c) => <StageCaption creature={c} turnLabel={active?.is_player ? 'Your turn' : 'Acting now'} />} />
        <Cascade aria-label="Turn order">
          {ordered.map((c, i) => (
            <PlayerRow key={c.id} creature={c} index={i} active={c.id === active?.id} />
          ))}
        </Cascade>
      </Board>

      {next && <CommandLine label="next up" className="px-4 pt-4 pb-8 lg:absolute lg:right-8 lg:bottom-8 lg:w-[min(30rem,40%)] lg:p-0">{next.name}</CommandLine>}
    </div>
  )
}

function Waiting() {
  return (
    <div className="hatch absolute inset-0 flex flex-col justify-end gap-5 bg-raised pr-[14%] pb-[calc(var(--slant)*100cqw+12px)] pl-5 lg:pb-14 lg:pl-10">
      <Dices className="size-10 text-accent" />
      <p className="display print text-[clamp(2.5rem,min(9cqh,6.5cqw),7rem)] leading-[1] text-vellum">
        Roll for
        <br />
        initiative
      </p>
      <p className="max-w-xs text-ink-muted">The fight starts when your DM begins combat. This screen updates on its own.</p>
    </div>
  )
}

/** One creature in the players' cascade: big name, and only what the table is allowed to know. */
export function PlayerRow({ creature: c, index, active }: { creature: SharedCreature; index: number; active: boolean }) {
  const dead = hasCondition(c.conditions, 'dead')
  const visible = c.conditions.filter((x) => x.key !== 'dead')
  return (
    <CascadeRow index={index} aria-current={active ? 'step' : undefined} className={cn('flex items-center gap-3 pr-1 lg:gap-5 lg:pr-10', dead && 'opacity-40')}>
      {/* Name on the slope; conditions on a fixed line under it, so every name sits at the same height. */}
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-[calc(var(--row-h)*0.03)] text-[calc(var(--row-h)*0.31)] sm:text-[calc(var(--row-h)*0.34)] lg:text-[calc(var(--row-h)*0.42)]">
        <span className={cn('relative isolate flex h-[1.36em] max-w-full min-w-0 items-center gap-[0.35em] self-start pl-[0.3em]', active ? 'pr-[1.3em]' : 'pr-[0.5em]')}>
          {active && <TurnWedge />}
          <span className={cn('figure w-[1.5em] shrink-0 text-right text-[0.56em]', active ? 'text-vellum-ink' : 'text-ink-faint')}>
            {c.initiative}
          </span>
          <span
            className={cn(
              'display truncate pr-[0.1em] leading-[1.3]',
              active ? 'text-rubric' : 'text-ink',
              dead && 'line-through decoration-[0.06em]',
            )}
          >
            {c.name}
          </span>
        </span>
        <span className="flex h-5 min-w-0 gap-1 overflow-hidden pl-[1.4em]">
          {visible.map((x) => (
            <ConditionChip key={x.key} condition={x} />
          ))}
        </span>
      </span>

      <span className="w-[4.5rem] shrink-0 text-right sm:w-24 lg:w-32">
        {c.is_player && c.max_hp !== null ? (
          <>
            <span className="tabular cmd block text-sm text-ink-muted">
              {c.current_hp}/{c.max_hp}
              {c.temp_hp > 0 && <span className="text-vellum"> +{c.temp_hp}</span>}
            </span>
            <HpBar current={c.current_hp} max={c.max_hp} temp={c.temp_hp} className="mt-1" />
          </>
        ) : (
          c.health && !dead && <HealthTag band={c.health} className="text-base" />
        )}
      </span>
    </CascadeRow>
  )
}
