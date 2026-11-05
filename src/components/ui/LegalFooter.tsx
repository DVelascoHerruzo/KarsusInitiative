import { Link } from 'react-router'
import { BACKDROP_CREDIT, KOFI_URL } from '@/lib/legal'

/**
 * Every page's small print: the legal pages, a way to support the site, the
 * backdrop's credit, and that this is an unofficial fan tool.
 */
export function LegalFooter({ className }: { className?: string }) {
  const link = 'underline decoration-dnd-border underline-offset-2 transition-colors hover:text-dnd-parchment'
  return (
    <div className={className}>
      <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link to="/privacy" className={link}>
          Privacy
        </Link>
        <Link to="/terms" className={link}>
          Terms
        </Link>
        <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" className={link} title="Karsus is free. If it helps your table, you can buy us a coffee on Ko-fi.">
          Support us on Ko-fi
        </a>
      </p>
      {BACKDROP_CREDIT && (
        <p className="mt-1">
          Backdrop:{' '}
          <a href={BACKDROP_CREDIT.href} target="_blank" rel="noopener noreferrer" className={link}>
            {BACKDROP_CREDIT.text}
          </a>
          .
        </p>
      )}
      <p className="mt-1">Karsus is an unofficial fan tool, not affiliated with or endorsed by Wizards of the Coast. Dungeons &amp; Dragons and D&amp;D are their trademarks.</p>
    </div>
  )
}
