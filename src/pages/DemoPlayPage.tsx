import { useDemoEncounter } from '@/features/demo/demoStore'
import { DisplayView, toSharedEncounter } from '@/features/play/DisplayView'

export default function DemoPlayPage() {
  const encounter = useDemoEncounter()
  return (
    <>
      <title>Player view (demo) · Karsus</title>
      <DisplayView encounter={toSharedEncounter(encounter)} label="Player View · Demo" />
    </>
  )
}
