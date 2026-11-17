'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { LOCALE_META, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Inline SVG flags: emoji flags don't render on Windows (they show "DE" / "GB" letters).

function FlagDE() {
  return (
    <svg viewBox="0 0 5 3" className="w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="5" height="1" y="0" fill="#000000" />
      <rect width="5" height="1" y="1" fill="#DD0000" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  )
}

function FlagGB() {
  // Unique clip ids, since the switcher can appear more than once on a page.
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 60 30" className="w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <clipPath id={`s${id}`}>
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id={`t${id}`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath={`url(#s${id})`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#t${id})`} stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  )
}

// Five-pointed star with one point towards the crescent, as on the Turkish flag.
const TR_STAR = Array.from({ length: 10 }, (_, i) => {
  const angle = Math.PI + (i * Math.PI) / 5
  const r = i % 2 === 0 ? 100 : 38.2
  return `${(583 + r * Math.cos(angle)).toFixed(1)},${(400 + r * Math.sin(angle)).toFixed(1)}`
}).join(' ')

function FlagTR() {
  return (
    <svg viewBox="0 0 1200 800" className="w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="1200" height="800" fill="#E30A17" />
      <circle cx="425" cy="400" r="200" fill="#fff" />
      <circle cx="475" cy="400" r="160" fill="#E30A17" />
      <polygon points={TR_STAR} fill="#fff" />
    </svg>
  )
}

function FlagUA() {
  return (
    <svg viewBox="0 0 3 2" className="w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="3" height="1" y="0" fill="#0057B7" />
      <rect width="3" height="1" y="1" fill="#FFD700" />
    </svg>
  )
}

// Arabic is spoken in many countries, so it gets a neutral letter badge instead of one country's flag.
function FlagAR() {
  return (
    <svg viewBox="0 0 30 20" className="w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="30" height="20" fill="#0F7A4A" />
      <text x="15" y="15" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="var(--font-arabic), Tahoma, sans-serif">
        ع
      </text>
    </svg>
  )
}

const OPTIONS: { code: Locale; Flag: () => React.JSX.Element }[] = [
  { code: 'de', Flag: FlagDE },
  { code: 'en', Flag: FlagGB },
  { code: 'tr', Flag: FlagTR },
  { code: 'uk', Flag: FlagUA },
  { code: 'ar', Flag: FlagAR },
]

/** Flag button that opens a menu of all languages. */
export function LanguageSwitcher({ className, align = 'end' }: { className?: string; align?: 'start' | 'end' }) {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()
  const current = OPTIONS.find((o) => o.code === language) ?? OPTIONS[0]

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Focus the active language when the menu opens.
  useEffect(() => {
    if (open) itemRefs.current[OPTIONS.indexOf(current)]?.focus()
  }, [open, current])

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  const onMenuKey = (e: KeyboardEvent) => {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(i + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(i - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const choose = (code: Locale) => {
    setOpen(false)
    buttonRef.current?.focus()
    if (code !== language) setLanguage(code)
  }

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Language / Sprache: ${LOCALE_META[current.code].nativeName}`}
        title={LOCALE_META[current.code].nativeName}
        className="inline-flex items-center gap-1.5 rounded-full bg-cream border border-border ps-1 pe-2 py-1 hover:border-primary/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      >
        <span className="relative w-8 h-6 rounded-full overflow-hidden shadow-soft ring-1 ring-black/5">
          <current.Flag />
        </span>
        <span className="text-xs font-semibold uppercase text-dark-gray">{current.code}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Language / Sprache"
          onKeyDown={onMenuKey}
          className={cn(
            'absolute z-50 mt-2 w-48 rounded-xl border border-border bg-white p-1 shadow-premium',
            align === 'end' ? 'end-0' : 'start-0'
          )}
        >
          {OPTIONS.map(({ code, Flag }, i) => {
            const active = code === language
            const meta = LOCALE_META[code]
            return (
              <button
                key={code}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                tabIndex={-1}
                onClick={() => choose(code)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-sm transition-colors focus:outline-none focus-visible:bg-cream hover:bg-cream',
                  active ? 'font-semibold text-primary' : 'text-dark-gray'
                )}
              >
                <span className="relative w-7 h-5 shrink-0 rounded overflow-hidden ring-1 ring-black/10">
                  <Flag />
                </span>
                <span lang={code} className="flex-1">
                  {meta.nativeName}
                </span>
                {active && <Check className="w-4 h-4 shrink-0" aria-hidden />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
