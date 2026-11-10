import { useSyncExternalStore } from 'react'

// Display settings, kept per device like the colour theme: a laptop at the table,
// a phone, and the TV everyone reads from across the room each want different
// things. They're attributes on <html>, so the stylesheet does the work (the
// "Display settings" section of index.css), on every page.

export type TextSize = 'default' | 'large' | 'larger'
export type FontChoice = 'classic' | 'clear'
export type HealthColors = 'standard' | 'red-green' | 'blue-yellow'

export interface Display {
  textSize: TextSize
  font: FontChoice
  health: HealthColors
  /** Brighter secondary text and borders, solid panels, a brighter danger red. */
  contrast: boolean
  /** Turns, dialogs and dice appear instantly instead of sliding and fading. */
  calm: boolean
  /** No painting behind the pages, just the theme's dark background. */
  plain: boolean
}

export const TEXT_SIZES: { id: TextSize; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'large', label: 'Large' },
  { id: 'larger', label: 'Larger' },
]

export const FONTS: { id: FontChoice; label: string; detail: string }[] = [
  { id: 'classic', label: 'Classic', detail: 'Cinzel and IM Fell, the look of an old tome.' },
  { id: 'clear', label: 'Clear', detail: 'Atkinson Hyperlegible: plain shapes, and no mixing up I, l and 1 or O and 0.' },
]

export const HEALTH_COLORS: { id: HealthColors; label: string; detail: string }[] = [
  { id: 'standard', label: 'Classic', detail: 'Green, yellow and red.' },
  { id: 'red-green', label: 'Blue & orange', detail: 'Blue, yellow and orange. Clear with red–green color blindness.' },
  { id: 'blue-yellow', label: 'Green & amber', detail: 'Green, pale amber and deep orange, spaced by brightness. Clear with blue–yellow color blindness.' },
]

const KEY = 'display'

const prefers = (query: string) => typeof matchMedia === 'function' && matchMedia(query).matches
const oneOf = <T extends string>(value: unknown, options: { id: T }[], fallback: T): T => (options.some((o) => o.id === value) ? (value as T) : fallback)

function read(): Display {
  let saved: Partial<Display> | null = null
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Display> | null
  } catch {
    // Private mode or a damaged value: start from the defaults.
  }
  return {
    textSize: oneOf(saved?.textSize, TEXT_SIZES, 'default'),
    font: oneOf(saved?.font, FONTS, 'classic'),
    health: oneOf(saved?.health, HEALTH_COLORS, 'standard'),
    // Until someone chooses, these two follow the device's own settings.
    contrast: typeof saved?.contrast === 'boolean' ? saved.contrast : prefers('(prefers-contrast: more)'),
    calm: typeof saved?.calm === 'boolean' ? saved.calm : prefers('(prefers-reduced-motion: reduce)'),
    plain: saved?.plain === true,
  }
}

let fontRequested = false

/** Downloads the Clear font (about 35 KB), once: when it's chosen, or to preview it. */
export function loadClearFont() {
  if (fontRequested) return
  fontRequested = true
  void Promise.all([import('@fontsource-variable/atkinson-hyperlegible-next/index.css'), import('@fontsource-variable/atkinson-hyperlegible-next/wght-italic.css')])
}

/** Sets the attributes the stylesheet keys on. */
export function applyDisplay(d: Display) {
  const root = document.documentElement
  const set = (name: string, value: string | false) => (value ? root.setAttribute(name, value) : root.removeAttribute(name))
  set('data-text-size', d.textSize !== 'default' && d.textSize)
  set('data-font', d.font === 'clear' && 'clear')
  set('data-vision', d.health !== 'standard' && d.health)
  set('data-contrast', d.contrast && 'more')
  set('data-motion', d.calm && 'reduce')
  set('data-backdrop', d.plain && 'plain')
  if (d.font === 'clear') loadClearFont()
}

// ─── A tiny shared store, so the account menu and page stay in step ──────────

let current: Display = read()
const listeners = new Set<() => void>()

export const savedDisplay = () => current

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Changed in another tab: follow it here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    current = read()
    applyDisplay(current)
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function setDisplay(patch: Partial<Display>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Private mode: the setting lasts until the tab closes.
  }
  applyDisplay(current)
  for (const listener of listeners) listener()
}

export function useDisplay(): [Display, (patch: Partial<Display>) => void] {
  return [useSyncExternalStore(subscribe, savedDisplay), setDisplay]
}
