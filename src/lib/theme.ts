import { useEffect, useState } from 'react'

// Colour themes, kept per browser. The stylesheet defines the presets under
// html[data-theme]; a custom theme is built here from two colours the user picks
// and set as inline variables on <html>, which win over the stylesheet.

type PresetTheme = 'teal' | 'black' | 'white' | 'red' | 'yellow' | 'green' | 'orange' | 'purple'
type ThemeId = PresetTheme | 'custom'

export const THEMES: { id: PresetTheme; label: string; color: string }[] = [
  { id: 'teal', label: 'Teal', color: '#2DD4BF' },
  { id: 'black', label: 'Black', color: '#9CA3AF' },
  { id: 'white', label: 'White', color: '#E2E8F0' },
  { id: 'red', label: 'Red', color: '#EF4444' },
  { id: 'yellow', label: 'Yellow', color: '#FBBF24' },
  { id: 'green', label: 'Green', color: '#34D399' },
  { id: 'orange', label: 'Orange', color: '#FB923C' },
  { id: 'purple', label: 'Purple', color: '#A78BFA' },
]

/** The two colours of a custom theme: buttons and highlights, and headings. */
interface CustomColors {
  primary: string
  heading: string
}

const DEFAULT_CUSTOM: CustomColors = { primary: '#0D9488', heading: '#E8A917' }

const KEY = 'theme'
const CUSTOM_KEY = 'theme-custom'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode: the theme just won't be remembered.
  }
}

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

export function savedTheme(): ThemeId {
  const value = read(KEY)
  return value === 'custom' || THEMES.some((t) => t.id === value) ? (value as ThemeId) : 'teal'
}

function savedCustom(): CustomColors {
  try {
    const parsed = JSON.parse(read(CUSTOM_KEY) ?? 'null') as Partial<CustomColors> | null
    if (parsed && isHex(parsed.primary) && isHex(parsed.heading)) return { primary: parsed.primary, heading: parsed.heading }
  } catch {
    // Fall through to the default.
  }
  return DEFAULT_CUSTOM
}

// ─── Building a palette from two colours ─────────────────────────────────────

type Hsl = [h: number, s: number, l: number]

function hexToHsl(hex: string): Hsl {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

function hslToRgb([h, s, l]: Hsl): [number, number, number] {
  const sat = s / 100
  const light = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as [number, number, number]
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Every theme variable from two colours. The backgrounds are near-black tints of
 * the main colour's hue, as in the preset themes, so any pick stays readable.
 */
function customPalette({ primary, heading }: CustomColors): Record<string, string> {
  const [h, s, l] = hexToHsl(primary)
  const [hh, hs, hl] = hexToHsl(heading)
  // Greys stay grey: tint the backgrounds only as much as the colour itself is saturated.
  const tint = 55 * Math.min(1, s / 50)
  const colors: Record<string, Hsl> = {
    'theme-primary': [h, s, l],
    'theme-accent': [h, s, clamp(l + 16, 45, 75)],
    'bg-black': [h, tint, 4],
    'bg-dark': [h, tint, 6.5],
    'bg-surface': [h, tint * 0.9, 9.5],
    'bg-card': [h, tint * 0.85, 12.5],
    'bg-border': [h, tint * 0.8, 21],
    'color-text': [h, Math.min(60, tint), 90],
    'color-muted': [h, Math.min(30, tint * 0.6), 52],
    'color-heading': [hh, hs, hl],
    'color-heading-bright': [hh, hs, clamp(hl + 10, 0, 85)],
  }
  const vars: Record<string, string> = {}
  for (const [name, hsl] of Object.entries(colors)) {
    const rgb = hslToRgb(hsl)
    vars[`--${name}`] = `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
    vars[`--${name}-rgb`] = rgb.join(' ')
  }
  // The colours exactly as picked, not rounded through HSL.
  vars['--theme-primary'] = primary
  vars['--color-heading'] = heading
  return vars
}

const CUSTOM_VARS = Object.keys(customPalette(DEFAULT_CUSTOM))

export function applyTheme(theme: ThemeId, custom: CustomColors = savedCustom()) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  if (theme === 'custom') {
    for (const [name, value] of Object.entries(customPalette(custom))) root.style.setProperty(name, value)
  } else {
    for (const name of CUSTOM_VARS) root.style.removeProperty(name)
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(savedTheme)
  const [custom, setCustom] = useState<CustomColors>(savedCustom)
  useEffect(() => {
    applyTheme(theme, custom)
    write(KEY, theme)
    write(CUSTOM_KEY, JSON.stringify(custom))
  }, [theme, custom])
  return {
    theme,
    setTheme,
    custom,
    /** Changing a custom colour switches to the custom theme. */
    setCustom: (next: CustomColors) => {
      setCustom(next)
      setTheme('custom')
    },
  }
}

/** The landing and sign-in pages always show the brand's teal, whatever theme the visitor picked. */
export function useTealTheme() {
  useEffect(() => {
    applyTheme('teal')
    return () => applyTheme(savedTheme())
  }, [])
}
