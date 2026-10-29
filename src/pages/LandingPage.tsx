import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { Coffee } from 'lucide-react'
import { Brand } from '@/components/layout/AppShell'
import { ButtonLink } from '@/components/ui/Button'
import { Avatar, ConditionChip, HealthTag, HpBar, Kbd } from '@/components/ui/display'
import { Board, Cascade, Shard } from '@/features/combat/Cascade'
import { RoundBox, StageCaption } from '@/features/combat/StageParts'
import { TurnStage, useTurnDirection } from '@/features/combat/TurnStage'
import { seedEncounter } from '@/features/demo/demoStore'
import { PlayerRow, toSharedEncounter } from '@/features/play/PlayerBoard'
import { hasCondition } from '@/lib/conditions'
import { cn } from '@/lib/cn'

const demo = toSharedEncounter(seedEncounter())
const order = demo.creatures.filter((c) => !hasCondition(c.conditions, 'dead'))

/** Steps through the demo's turn order on a timer: the hero is the product doing its job. */
function useTurnLoop() {
  const reduce = useReducedMotion()
  const start = Math.max(0, order.findIndex((c) => c.id === demo.active_creature_id))
  const [turn, setTurn] = useState(start)
  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setTurn((n) => n + 1), 2800)
    return () => clearInterval(t)
  }, [reduce])
  const creature = order[turn % order.length]!
  return { creature, round: demo.round + Math.floor(turn / order.length), index: demo.creatures.indexOf(creature) }
}

export default function LandingPage() {
  const { creature, round, index } = useTurnLoop()
  const direction = useTurnDirection({ round, index })

  return (
    <div className="overflow-x-clip">
      <header className="relative z-20 flex h-16 items-center gap-2 border-b border-line bg-canvas px-4 sm:px-8">
        <Brand />
        <div className="flex-1" />
        <ButtonLink to="/demo" variant="ghost" size="sm" className="hidden sm:inline-flex">
          Demo
        </ButtonLink>
        <ButtonLink to="/login" variant="ghost" size="sm">
          Sign in
        </ButtonLink>
        <ButtonLink to="/login" variant="secondary" size="sm" className="hidden sm:inline-flex">
          Create account
        </ButtonLink>
      </header>

      <main>
        {/* ── Hero: the stage, running the demo fight ─────────────────── */}
        <section className="relative lg:grid lg:h-[max(600px,calc(100dvh-4rem))] lg:grid-cols-[minmax(0,64fr)_minmax(0,36fr)]">
          <div className="relative min-w-0 lg:h-full" aria-hidden>
            <Board count={demo.creatures.length} className="[--pad-bottom:36px] [--pad-top:36px] [--row-max:76px] [--stage-top:30cqw] lg:h-full">
              <TurnStage creature={creature} direction={direction} idle={null} caption={(c) => <StageCaption creature={c} turnLabel="Acting now" />} />
              <Cascade>
                {demo.creatures.map((c, i) => (
                  <PlayerRow key={c.id} creature={c} index={i} active={c.id === creature.id} />
                ))}
              </Cascade>
            </Board>
            <RoundBox round={round} className="absolute top-5 left-5" />
          </div>

          <div className="flex min-w-0 flex-col justify-between gap-10 border-line px-5 py-10 sm:px-8 lg:border-l lg:py-12">
            <div>
              <h1 className="display text-4xl text-vellum 2xl:text-5xl">
                Initiative tracker for theater-of-the-mind combat
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-muted">
                Karsus keeps the turn order, hit points and conditions, and puts a live turn tracker on every player’s screen. You keep your eyes
                on the table.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink to="/demo" variant="primary" size="lg">
                Try the demo
              </ButtonLink>
              <ButtonLink to="/login" size="lg">
                Create a free account
              </ButtonLink>
            </div>
          </div>
        </section>

        <FeatureMenu />

        {/* ── Close ─────────────────────────────────────────────────── */}
        <section className="relative border-t border-line py-20 pr-5 pl-10 sm:pr-8 lg:py-28 lg:pl-24">
          <span aria-hidden className="absolute inset-y-16 left-0 w-4 bg-accent sm:w-6 lg:inset-y-24 lg:w-12" />
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <p className="display text-4xl text-vellum sm:text-6xl lg:text-[8rem]">
              Roll for
              <br />
              initiative
            </p>
            <div className="flex flex-wrap gap-3 lg:pb-3">
              <ButtonLink to="/demo" variant="primary" size="lg">
                Open the demo
              </ButtonLink>
              <ButtonLink to="/login" size="lg">
                Sign up, it’s free
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-6 text-sm text-ink-faint sm:px-8">
        <span>© {new Date().getFullYear()} Karsus Initiative</span>
        <div className="flex-1" />
        <a href="https://ko-fi.com/barope" target="_blank" rel="noreferrer" className="cmd inline-flex items-center gap-1.5 hover:text-ink">
          <Coffee className="size-4" /> Support on Ko-fi
        </a>
      </footer>
    </div>
  )
}

// ─── What it handles: a pause menu of features ────────────────────────────────

const FEATURES: { id: string; label: string; note: string; fragment: () => ReactNode }[] = [
  { id: 'damage', label: 'Damage', note: 'Temp HP soaks first. At zero, monsters fall and player characters drop unconscious.', fragment: DamageFragment },
  { id: 'conditions', label: 'Conditions', note: 'Give Hold Person ten rounds and forget it. Timers tick down at the end of the creature’s turn.', fragment: ConditionsFragment },
  { id: 'players', label: 'Player screen', note: 'Players see Bloodied, never 12 of 45. Monster AC and your notes never leave your screen.', fragment: ShareFragment },
  { id: 'dice', label: 'Dice', note: 'Advantage, keep-highest, whole groups. One key rolls initiative for every monster.', fragment: DiceFragment },
  { id: 'keys', label: 'Shortcuts', note: 'Space for the next turn, a letter for everything else. Your hands stay where they were.', fragment: KeysFragment },
]

function FeatureMenu() {
  const [selected, setSelected] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const feature = FEATURES[selected]!

  function onKey(e: KeyboardEvent) {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (selected + step + FEATURES.length) % FEATURES.length
    setSelected(next)
    tabs.current[next]?.focus()
  }

  return (
    <section aria-labelledby="features" className="border-t border-line px-5 py-20 sm:px-8 lg:py-28">
      <h2 id="features" className="display max-w-3xl text-3xl text-vellum sm:text-4xl">
        The bookkeeping, handled while the scene keeps moving
      </h2>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        {/* Each item steps right along the system slant, like the turn cascade. */}
        <div role="tablist" aria-orientation="vertical" aria-label="Features" onKeyDown={onKey} className="flex flex-col">
          {FEATURES.map((f, i) => {
            const on = i === selected
            return (
              <button
                key={f.id}
                ref={(el) => {
                  tabs.current[i] = el
                }}
                id={`tab-${f.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="feature-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setSelected(i)}
                style={{ '--i': i } as CSSProperties}
                className={cn(
                  'relative isolate ml-[calc(var(--i)*var(--slant)*4.25rem)] h-[4.25rem] self-start pr-[1.3em] pl-[0.4em] text-left text-2xl transition-colors sm:text-4xl',
                  on ? 'text-rubric' : 'text-ink hover:text-vellum',
                )}
              >
                {on && <Shard layoutId="feature-wedge" />}
                <span className="display">{f.label}</span>
              </button>
            )
          })}
        </div>

        <div id="feature-panel" role="tabpanel" aria-labelledby={`tab-${feature.id}`} className="flex min-h-80 flex-col justify-between gap-10 border-t-2 border-rubric bg-panel p-6 sm:p-8">
          <div aria-hidden>
            <feature.fragment />
          </div>
          <div>
            <p className="cmd max-w-lg text-lg text-ink">{feature.note}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="hint">{feature.label.toLowerCase()}</span>
              <span className="h-px flex-1 bg-ink/40" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DamageFragment() {
  return (
    <div className="max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name="Goblin 2" size={40} />
        <span className="display flex-1 text-2xl text-vellum">Goblin 2</span>
        <HealthTag band="bloodied" />
      </div>
      <div className="flex items-stretch gap-2">
        <span className="tabular display flex h-20 flex-1 items-center justify-center border border-line bg-canvas text-5xl text-vellum">4</span>
        <span className="wedge cmd flex items-center px-6 text-vellum [--wedge:var(--color-rubric)]">Damage</span>
      </div>
      <HpBar current={3} max={7} thick />
    </div>
  )
}

const SAMPLE_CONDITIONS = [
  { key: 'concentrating', rounds: null },
  { key: 'custom:bless', label: 'Bless', rounds: 7 },
  { key: 'frightened', rounds: 1 },
  { key: 'prone', rounds: null },
  { key: 'poisoned', rounds: 2 },
  { key: 'restrained', rounds: 3 },
  { key: 'invisible', rounds: 10 },
]

function ConditionsFragment() {
  return (
    <div className="flex max-w-lg flex-wrap gap-2">
      {SAMPLE_CONDITIONS.map((c) => (
        <ConditionChip key={c.key} condition={c} size="md" />
      ))}
    </div>
  )
}

function ShareFragment() {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="bg-vellum p-3">
        <QRCodeSVG value="https://karsusinitiative.com/demo/play" size={120} marginSize={0} bgColor="transparent" fgColor="#0a0b1e" />
      </div>
      <ul className="min-w-56 flex-1 space-y-px">
        {demo.creatures.slice(1, 4).map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 bg-canvas px-3 py-2">
            <span className="display truncate text-xl text-ink">{c.name}</span>
            {c.is_player ? (
              <span className="tabular cmd text-sm text-ink-muted">
                {c.current_hp}/{c.max_hp}
              </span>
            ) : (
              c.health && <HealthTag band={c.health} />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const SAMPLE_ROLLS = [
  { label: 'Attack with advantage', detail: '[6, 17] + 5', total: 22, crit: false },
  { label: 'Fireball, 8d6', detail: '[4, 6, 2, 5, 3, 6, 1, 4]', total: 31, crit: false },
  { label: 'Death save', detail: '[20]', total: 20, crit: true },
]

function DiceFragment() {
  return (
    <ol className="max-w-md space-y-px">
      {SAMPLE_ROLLS.map((r) => (
        <li key={r.label} className="flex items-center gap-3 bg-canvas px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="cmd block truncate text-sm text-ink-muted">{r.label}</span>
            <span className="tabular block truncate text-xs text-ink-faint">{r.detail}</span>
          </span>
          <span className={cn('tabular display text-3xl', r.crit ? 'text-warn' : 'text-vellum')}>{r.total}</span>
        </li>
      ))}
    </ol>
  )
}

const SAMPLE_KEYS: [string[], string][] = [
  [['Space'], 'Next turn'],
  [['D'], 'Damage'],
  [['H'], 'Heal'],
  [['C'], 'Conditions'],
  [['J', 'K'], 'Pick a creature'],
  [['I'], 'Roll monster initiative'],
]

function KeysFragment() {
  return (
    <dl className="grid max-w-lg gap-px sm:grid-cols-2">
      {SAMPLE_KEYS.map(([k, label]) => (
        <div key={label} className="flex items-center justify-between gap-2 bg-canvas px-3 py-2">
          <dt className="truncate text-sm text-ink-muted">{label}</dt>
          <dd className="flex gap-1">
            {k.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  )
}
