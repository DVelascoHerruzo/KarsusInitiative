import { useEffect, useState } from 'react'

// Colour themes, kept per browser. The stylesheet defines each one under html[data-theme].

export type ThemeId = 'teal' | 'black' | 'white' | 'red' | 'yellow' | 'green' | 'orange' | 'purple'

export const THEMES: { id: ThemeId; label: string; color: string }[] = [
  { id: 'teal', label: 'Teal', color: '#2DD4BF' },
  { id: 'black', label: 'Black', color: '#9CA3AF' },
  { id: 'white', label: 'White', color: '#E2E8F0' },
  { id: 'red', label: 'Red', color: '#EF4444' },
  { id: 'yellow', label: 'Yellow', color: '#FBBF24' },
  { id: 'green', label: 'Green', color: '#34D399' },
  { id: 'orange', label: 'Orange', color: '#FB923C' },
  { id: 'purple', label: 'Purple', color: '#A78BFA' },
]

const KEY = 'theme'

export function savedTheme(): ThemeId {
  try {
    const value = localStorage.getItem(KEY)
    return THEMES.some((t) => t.id === value) ? (value as ThemeId) : 'teal'
  } catch {
    return 'teal'
  }
}

export function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(savedTheme)
  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // Private mode: the theme just won't be remembered.
    }
  }, [theme])
  return [theme, setTheme] as const
}

/** The landing and sign-in pages always show the brand's teal, whatever theme the visitor picked. */
export function useTealTheme() {
  useEffect(() => {
    applyTheme('teal')
    return () => applyTheme(savedTheme())
  }, [])
}

/** Marks a page as a screen the table watches, which hides the Ko-fi button. */
export function useDisplayScreen() {
  useEffect(() => {
    document.documentElement.setAttribute('data-display', '')
    return () => document.documentElement.removeAttribute('data-display')
  }, [])
}
