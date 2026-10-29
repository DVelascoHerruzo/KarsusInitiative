import { useState } from 'react'
import { MonitorPlay, RotateCcw, Share2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EncounterBoard } from '@/features/combat/EncounterBoard'
import { ShareDialog, openPlayerWindow } from '@/features/encounters/ShareDialog'
import { demoActions, resetDemo, useDemoEncounter } from '@/features/demo/demoStore'

export default function DemoPage() {
  const encounter = useDemoEncounter()
  const [sharing, setSharing] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const playUrl = `${window.location.origin}/demo/play`

  return (
    <AppShell
      bleed
      guest
      title={encounter.title}
      subtitle={encounter.description}
      actions={
        <>
          <span className="hint hidden xl:inline">demo, saved in this browser</span>
          <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
            <RotateCcw /> <span className="max-md:sr-only">Reset</span>
          </Button>
          <Button size="sm" onClick={() => setSharing(true)}>
            <Share2 /> <span className="max-md:sr-only">Share</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => openPlayerWindow(playUrl)}>
            <MonitorPlay /> <span className="max-md:sr-only">Player view</span>
          </Button>
        </>
      }
    >
      <title>Demo · Karsus</title>
      <EncounterBoard encounter={encounter} actions={demoActions} />

      <section className="flex flex-col gap-6 border-t border-line px-4 py-16 sm:px-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="border-l-4 border-accent pl-5">
          <h2 className="display text-4xl text-vellum sm:text-5xl">
            Ready for
            <br />
            your own table?
          </h2>
          <p className="mt-4 max-w-md text-ink-muted">
            A free account saves encounters and presets, adds portraits and backdrops, and gives every fight a shareable player link.
          </p>
        </div>
        <ButtonLink to="/login" variant="primary" size="lg">
          Create a free account
        </ButtonLink>
      </section>

      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        url={playUrl}
        enabled={null}
        onOpenWindow={() => openPlayerWindow(playUrl)}
      />
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset the demo?"
        body="Puts the ambush back the way it started."
        confirmLabel="Reset"
        onConfirm={() => {
          resetDemo()
          setConfirmReset(false)
        }}
      />
    </AppShell>
  )
}
