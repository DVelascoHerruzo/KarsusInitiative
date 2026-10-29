import { useEffect, useRef } from 'react'

export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>

const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
const ACTIVATES_ON_KEY = 'button, a[href], summary, [role="button"], [role="switch"]'

/** Normalises an event into a binding string such as `space`, `shift+space`, `d`, `?`, `arrowright`. */
function describe(e: KeyboardEvent): string {
  const key = e.key === ' ' ? 'space' : e.key.toLowerCase()
  // `?` already implies shift, so only prefix shift for non-printing keys.
  return e.shiftKey && key.length > 1 ? `shift+${key}` : key
}

/**
 * Page-level shortcuts. They never fire while typing, while a dialog is open, or
 * with Ctrl/Cmd/Alt held, and Space/Enter are left alone on focused buttons so
 * native activation still works.
 */
export function useHotkeys(map: HotkeyMap, enabled = true) {
  const latest = useRef(map)
  useEffect(() => {
    latest.current = map
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
      const target = e.target as HTMLElement | null
      if (target?.closest(TYPING) || document.querySelector('dialog[open]')) return
      if ((e.key === ' ' || e.key === 'Enter') && target?.closest(ACTIVATES_ON_KEY)) return

      const handler = latest.current[describe(e)]
      if (handler) {
        e.preventDefault()
        handler(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
