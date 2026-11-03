import { useState } from 'react'
import { Link } from 'react-router'
import { ExternalLink, RotateCcw, Share2 } from 'lucide-react'
import ConfirmDelete from '@/components/ui/ConfirmDelete'
import Layout, { PageHeader } from '@/components/ui/Layout'
import { EncounterBoard } from '@/features/combat/EncounterBoard'
import { ShareDialog, openPlayerWindow } from '@/features/encounters/ShareDialog'
import { demoActions, resetDemo, useDemoEncounter } from '@/features/demo/demoStore'

/** The whole DM screen without an account, saved in this browser. */
export default function DemoPage() {
  const encounter = useDemoEncounter()
  const [sharing, setSharing] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const playUrl = `${window.location.origin}/demo/play`

  return (
    <Layout guest title="Demo">
      <title>Demo · Karsus</title>
      <div className="space-y-6">
        <PageHeader
          back={{ to: '/', label: 'Home' }}
          eyebrow="Demo · saved in this browser"
          title={encounter.title}
          description={encounter.description}
          actions={
            <>
              <button type="button" onClick={() => setConfirmReset(true)} className="dnd-button-ghost px-3 py-2 text-sm">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
              <button type="button" onClick={() => setSharing(true)} className="dnd-button-secondary px-4 py-2 text-sm">
                <Share2 className="h-4 w-4" /> Share
              </button>
              <button type="button" onClick={() => openPlayerWindow(playUrl)} className="dnd-button-primary px-4 py-2 text-sm">
                <ExternalLink className="h-4 w-4" /> Visual View
              </button>
            </>
          }
        />

        <EncounterBoard encounter={encounter} actions={demoActions} />

        <section className="dnd-card flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-3xl text-dnd-gold">Ready for your own table?</h2>
            <p className="mt-2 max-w-xl font-ui text-dnd-muted italic">
              A free account saves encounters and presets, adds portraits and backdrops, invites your players to campaigns, and gives every fight a shareable visual
              view.
            </p>
          </div>
          <Link to="/login" state={{ mode: 'register' }} className="dnd-button-primary px-8 py-3 text-base shadow-glow-teal">
            Begin Your Legend
          </Link>
        </section>
      </div>

      <ShareDialog open={sharing} onClose={() => setSharing(false)} url={playUrl} enabled={null} onOpenWindow={() => openPlayerWindow(playUrl)} />
      <ConfirmDelete
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset Demo"
        confirmLabel="Reset"
        body="Put the ambush back the way it started?"
        onConfirm={() => {
          resetDemo()
          setConfirmReset(false)
        }}
      />
    </Layout>
  )
}
