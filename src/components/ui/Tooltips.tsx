import { useEffect, useState } from 'react'

// One tooltip for the whole app. Any element with a `title` (or `data-tip`) gets
// it: rest the pointer on it, or reach it with the keyboard, and after a moment
// a short note on what it does appears beside it. The browser's own title popup
// is suppressed by moving the text to data-tip, and the text stays available to
// screen readers as the element's description.

const DELAY_MS = 600
const GAP = 8

interface Shown {
  text: string
  rect: DOMRect
}

/** The text an element offers, taking over its title so the browser doesn't show its own popup too. */
function claim(el: HTMLElement): string | null {
  const title = el.getAttribute('title')
  if (title) {
    el.setAttribute('data-tip', title)
    el.removeAttribute('title')
    if (!el.hasAttribute('aria-description') && el.getAttribute('aria-label') !== title) el.setAttribute('aria-description', title)
  }
  return el.getAttribute('data-tip')
}

const target = (node: EventTarget | null) => (node instanceof Element ? node.closest<HTMLElement>('[title], [data-tip]') : null)

export function Tooltips() {
  const [shown, setShown] = useState<Shown | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let current: HTMLElement | null = null

    const hide = () => {
      clearTimeout(timer)
      current = null
      setShown(null)
    }
    const queue = (el: HTMLElement) => {
      const text = claim(el)
      if (!text || el === current) return
      hide()
      current = el
      timer = setTimeout(() => {
        if (current === el && el.isConnected) setShown({ text, rect: el.getBoundingClientRect() })
      }, DELAY_MS)
    }

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const el = target(e.target)
      if (el) queue(el)
      else if (current) hide()
    }
    const onOut = (e: PointerEvent) => {
      if (current && !current.contains(e.relatedTarget as Node | null)) hide()
    }
    // Scrolling moves the element away from a tooltip that's showing, but a pending one still measures it when it appears.
    const onScroll = () => setShown(null)
    const onFocus = (e: FocusEvent) => {
      const el = target(e.target)
      if (el && (e.target as HTMLElement).matches(':focus-visible')) queue(el)
    }

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', hide)
    document.addEventListener('pointerdown', hide)
    document.addEventListener('keydown', hide)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('blur', hide)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('pointerdown', hide)
      document.removeEventListener('keydown', hide)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  if (!shown) return null
  // Measured once it's drawn: above the element, or below when there's no room, always inside the window.
  const place = (node: HTMLDivElement | null) => {
    if (!node) return
    const { width, height } = node.getBoundingClientRect()
    const r = shown.rect
    const above = r.top - height - GAP
    node.style.top = `${above >= GAP ? above : Math.min(window.innerHeight - height - GAP, r.bottom + GAP)}px`
    node.style.left = `${Math.max(GAP, Math.min(window.innerWidth - width - GAP, r.left + r.width / 2 - width / 2))}px`
  }
  return (
    <div
      key={`${shown.text}:${shown.rect.left}:${shown.rect.top}`}
      ref={place}
      role="tooltip"
      className="pointer-events-none fixed z-[100] max-w-64 animate-fade-in rounded-lg border border-dnd-border bg-dnd-card px-3 py-2 font-ui text-xs leading-snug text-dnd-parchment shadow-card"
      style={{ left: -9999, top: -9999 }}
    >
      {shown.text}
    </div>
  )
}
