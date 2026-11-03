import { Link } from 'react-router'
import { ChevronRight, Monitor, ScrollText, Sword, Users } from 'lucide-react'
import { Logo } from '@/components/ui/Layout'
import { useTealTheme } from '@/lib/theme'

const FEATURES = [
  { icon: Sword, title: 'Live Turn Tracker', desc: 'Control initiative from your phone, watch it update on the big screen instantly.' },
  { icon: Monitor, title: 'Visual Display Mode', desc: 'Project a cinematic battle view with creature portraits and HP bars.' },
  { icon: ScrollText, title: 'Encounter Presets', desc: 'Save monster groups and your party, and drop them into any encounter in seconds.' },
  { icon: Users, title: 'Campaigns & Players', desc: 'Invite your players with a link. They keep their own sheets, or import them from D&D Beyond.' },
]

const MAP_CREDIT = [
  { href: 'https://smitchellmaps.com', label: 'smitchellmaps.com' },
  { href: 'https://patreon.com/smitchellmaps', label: 'Patreon: @smitchellmaps' },
  { href: 'https://instagram.com/smitchellarts', label: 'Instagram: @smitchellarts' },
]

export default function LandingPage() {
  useTealTheme()

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <title>Karsus – D&D Initiative Tracker</title>
      {/* Background: lighter at the top so the navbar reads, heavier toward the bottom to anchor the copy. */}
      <div className="absolute inset-0 z-0">
        <img src="/bg-city.jpg" alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-dnd-black/60 via-dnd-black/45 to-dnd-black/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-dnd-teal/10 via-transparent to-transparent" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-8">
        <Logo size="md" />
        <div className="flex items-center gap-3">
          <Link to="/login" className="dnd-button-ghost px-5 py-2 text-sm">
            Sign In
          </Link>
          <Link to="/login" state={{ mode: 'register' }} className="dnd-button-primary px-5 py-2 text-sm">
            Sign Up
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-7 px-6 pb-20 text-center">
        <div className="flex items-center gap-2.5 font-body text-xs tracking-[0.4em] text-dnd-jade uppercase">
          <Sword className="h-3.5 w-3.5" />
          <span>Initiative Tracker</span>
          <Sword className="h-3.5 w-3.5 rotate-180" />
        </div>

        <div>
          <h1 className="font-display text-6xl leading-none tracking-widest text-dnd-parchment drop-shadow-2xl sm:text-8xl">KARSUS</h1>
          <div className="mt-2 flex items-center justify-center gap-3" aria-hidden>
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-dnd-jade/60" />
            <div className="h-1.5 w-1.5 rounded-full bg-dnd-jade" />
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-dnd-jade/60" />
          </div>
        </div>

        <p className="max-w-xl font-ui text-lg leading-relaxed text-dnd-parchment/80">
          Command the battlefield. Track every turn.
          <br />
          Share the chaos — in real time, across any device.
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
          <Link to="/login" state={{ mode: 'register' }} className="dnd-button-primary px-8 py-3 text-base shadow-glow-teal">
            Begin Your Legend <ChevronRight className="h-4 w-4" />
          </Link>
          <Link to="/demo" className="dnd-button-secondary px-8 py-3 text-base">
            Try the Demo
          </Link>
        </div>

        <p className="mt-4 font-ui text-sm text-dnd-muted/60 italic">“Roll for initiative.”</p>
      </main>

      <footer className="relative z-10 border-t border-dnd-border/30 bg-dnd-dark/60 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-8 py-6">
          {/* Map art credit: on phones, above the features */}
          <div className="mb-6 border-b border-dnd-border/30 pb-5 text-center font-ui text-[10px] leading-relaxed text-white/50 xl:hidden">
            <p className="mb-2 font-body tracking-[0.2em] text-white/40 uppercase">Map Art</p>
            {MAP_CREDIT.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="block transition-colors hover:text-white/80">
                {l.label}
              </a>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 text-center sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center gap-2">
                <Icon className="h-5 w-5 text-dnd-jade" />
                <p className="font-body text-sm tracking-wider text-dnd-parchment">{title}</p>
                <p className="font-ui text-xs leading-relaxed text-dnd-muted">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Map art credit: on wider screens, bottom right */}
        <div className="absolute right-6 bottom-3 hidden text-right font-ui text-[10px] leading-relaxed text-white/50 sm:right-8 xl:block">
          <p className="mb-1 font-body tracking-[0.2em] text-white/40 uppercase">Map Art</p>
          {MAP_CREDIT.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="block transition-colors hover:text-white/80">
              {l.label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  )
}
