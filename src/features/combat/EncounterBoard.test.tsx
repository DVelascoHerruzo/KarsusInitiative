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
const rowOf = (name: string) => screen.getByRole('button', { name }).closest('li')!

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
    expect(screen.getByLabelText(/Brother Aldric: 14 of 31 hit points/)).toBeInTheDocument()
    expect(await screen.findByText('Brother Aldric: concentration check')).toBeInTheDocument()
  })

  it('adds a condition from the row and removes it again', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Conditions for Worg' }))
    await user.click(screen.getByRole('button', { name: 'Restrained' }))
    expect(within(rowOf('Worg')).getByText('Restrained')).toBeInTheDocument()

    await user.click(within(rowOf('Worg')).getByRole('button', { name: 'Remove Restrained' }))
    expect(within(rowOf('Worg')).queryByText('Restrained')).not.toBeInTheDocument()
  })

  it('sets a timed condition in the full dialog', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Conditions for Worg' }))
    await user.click(screen.getByRole('button', { name: 'Timed or custom…' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Poisoned' }))
    const poisoned = within(dialog).getByRole('button', { name: 'Poisoned' }).parentElement!
    await user.click(within(poisoned).getByRole('button', { name: 'More rounds' }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    expect(within(rowOf('Worg')).getByText('1r')).toBeInTheDocument()
  })

  it('edits initiative in place and re-sorts the order', async () => {
    const user = setup()
    const input = screen.getByLabelText('Initiative for Thorne')
    await user.clear(input)
    await user.type(input, '30{Enter}')
    const rows = within(screen.getByRole('list', { name: 'Initiative order' })).getAllByRole('listitem')
    expect(within(rows[0]!).getByRole('button', { name: 'Thorne' })).toBeInTheDocument()
  })
})
