import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { EncounterBoard } from './EncounterBoard'
import { demoActions, resetDemo, useDemoEncounter } from '@/features/demo/demoStore'

function DemoBoard() {
  return <EncounterBoard encounter={useDemoEncounter()} actions={demoActions} />
}

function setup() {
  localStorage.clear()
  resetDemo()
  // Start from a fresh, not-yet-started fight.
  demoActions.updateEncounter({ round: 1, active_creature_id: null })
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <DemoBoard />
      <Toaster />
    </MemoryRouter>,
  )
  return user
}

// The acting creature's name carries a visually hidden "Now acting:" prefix for screen readers.
const nowActing = () => screen.getByText(/^Now acting:/).parentElement?.textContent?.replace(/^Now acting:\s*/, '')

describe('EncounterBoard', () => {
  it('starts combat and steps turns from the keyboard, skipping the dead', async () => {
    const user = setup()
    expect(screen.getByText('Combat hasn’t started')).toBeInTheDocument()

    await user.keyboard(' ')
    expect(nowActing()).toBe('Vex')

    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    // Vex → Captain → Aldric → (Goblin 1 is dead) → Goblin 2
    expect(nowActing()).toBe('Goblin 2')

    await user.keyboard('{ArrowLeft}')
    expect(nowActing()).toBe('Brother Aldric')
  })

  it('applies damage through the HP dialog and calls for a concentration save', async () => {
    const user = setup()
    await user.keyboard(' {ArrowRight}{ArrowRight}') // Brother Aldric is active and selected

    await user.keyboard('d')
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Amount'), '9{Enter}')

    // 5 temp HP soak first, then 18 → 14
    const row = screen.getByLabelText(/Brother Aldric: 14 of 31 hit points/)
    expect(row).toBeInTheDocument()
    expect(await screen.findByText('Brother Aldric: concentration check')).toBeInTheDocument()
  })

  it('toggles a condition for the selected creature', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Conditions for Worg' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Restrained' }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    const worg = screen.getByText('Worg').closest('li')!
    expect(within(worg).getByText('Restrained')).toBeInTheDocument()
  })
})
