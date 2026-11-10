import { Link } from 'react-router'
import { ChevronRight, Monitor, ScrollText, Sword, Users } from 'lucide-react'
import { Logo } from '@/components/ui/Layout'
import { LegalFooter } from '@/components/ui/LegalFooter'
import { BACKDROP } from '@/lib/backdrop'
import { useTealTheme } from '@/lib/theme'

const FEATURES = [
  { icon: Sword, title: 'Live Turn Tracker', desc: 'Control initiative from your phone, watch it update on the big screen instantly.' },
  { icon: Monitor, title: 'Player View', desc: 'Put a cinematic battle view on a TV or every phone, with portraits and HP bars.' },
  { icon: ScrollText, title: 'Campaigns', desc: 'Save your party and monster groups once, and launch them into any encounter in seconds.' },
  { icon: Users, title: 'Players & Characters', desc: 'Invite your players with a link. They keep their own sheets, or import them from D&D Beyond.' },
]

export default function LandingPage() {
  useTealTheme()

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <title>Karsus – D&D Initiative Tracker</title>
      {/* Background: lighter at the top so the navbar reads, heavier toward the bottom to anchor the copy. */}
      <div className="absolute inset-0 z-0">
        <picture>
          <source type="image/avif" srcSet={BACKDROP.avif} sizes="100vw" />
          <source type="image/webp" srcSet={BACKDROP.webp} sizes="100vw" />
          <img src={BACKDROP.fallback} alt="" fetchPriority="high" decoding="async" className="h-full w-full object-cover object-center" />
        </picture>
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

        <LegalFooter className="border-t border-dnd-border/30 px-6 py-3 text-center font-ui text-[11px] leading-relaxed text-white/60" />
      </footer>
    </div>
  )
}
