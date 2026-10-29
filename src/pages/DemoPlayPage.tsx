import { useDemoEncounter } from '@/features/demo/demoStore'
import { PlayerBoard, toSharedEncounter } from '@/features/play/PlayerBoard'

export default function DemoPlayPage() {
  const encounter = useDemoEncounter()
  return (
    <>
      <title>Player view (demo) · Karsus</title>
      <PlayerBoard encounter={toSharedEncounter(encounter)} />
    </>
  )
}
