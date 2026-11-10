import { beforeEach, describe, expect, it } from 'vitest'
import { applyDisplay, savedDisplay, setDisplay, type Display } from './display'

const DEFAULTS: Display = { textSize: 'default', font: 'classic', health: 'standard', contrast: false, calm: false, plain: false }

const attrs = () => {
  const { textSize, font, vision, contrast, motion, backdrop } = document.documentElement.dataset
  return { textSize, font, vision, contrast, motion, backdrop }
}
const NONE = { textSize: undefined, font: undefined, vision: undefined, contrast: undefined, motion: undefined, backdrop: undefined }

describe('display settings', () => {
  beforeEach(() => {
    localStorage.clear()
    setDisplay(DEFAULTS)
  })

  it('leaves <html> untouched with the defaults', () => {
    expect(attrs()).toEqual(NONE)
  })

  it('sets the attributes the stylesheet keys on, and remembers them', () => {
    const all: Display = { textSize: 'larger', font: 'clear', health: 'red-green', contrast: true, calm: true, plain: true }
    setDisplay(all)
    expect(attrs()).toEqual({ textSize: 'larger', font: 'clear', vision: 'red-green', contrast: 'more', motion: 'reduce', backdrop: 'plain' })
    expect(JSON.parse(localStorage.getItem('display')!)).toEqual(all)
    expect(savedDisplay()).toEqual(all)
  })

  it('changes one setting without touching the others', () => {
    setDisplay({ health: 'blue-yellow' })
    setDisplay({ textSize: 'large' })
    expect(savedDisplay()).toEqual({ ...DEFAULTS, health: 'blue-yellow', textSize: 'large' })
    setDisplay({ health: 'standard' })
    expect(attrs()).toEqual({ ...NONE, textSize: 'large' })
  })

  it('clears attributes when settings go back to the defaults', () => {
    applyDisplay({ textSize: 'large', font: 'clear', health: 'blue-yellow', contrast: true, calm: true, plain: true })
    applyDisplay(DEFAULTS)
    expect(attrs()).toEqual(NONE)
  })
})
