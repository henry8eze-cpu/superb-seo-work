'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { cn } from '@/lib/utils'

/** Tabs whose panels are rendered on the server and passed in. */
export function CourseTabs({ tabs }: { tabs: { key: string; label: string; count: number; panel: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key)
  const reduce = useReducedMotion()
  const current = tabs.find((t) => t.key === active) ?? tabs[0]
  return (
    <div>
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={tab.key === active}
            onClick={() => setActive(tab.key)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border',
              tab.key === active ? 'bg-dark-gray text-white border-dark-gray' : 'bg-white text-dark-gray border-border hover:border-primary'
            )}
          >
            {tab.label} <span className="opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={current?.key}
          role="tabpanel"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="mt-6"
        >
          {current?.panel}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

/** Pick a CEFR level to see what it means and jump to matching courses. */
export function LevelGuide({ counts }: { counts: Partial<Record<(typeof LEVELS)[number], number>> }) {
  const { t } = useLanguage()
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('A1')
  const reduce = useReducedMotion()
  return (
    <div className="grid lg:grid-cols-[1fr_1.3fr] gap-8 items-stretch">
      <div className="grid grid-cols-3 gap-3 content-start">
        {LEVELS.map((l, i) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            aria-pressed={level === l}
            className={cn(
              'rounded-2xl p-4 text-start transition-all border-2',
              level === l ? 'bg-primary text-white border-primary shadow-premium scale-[1.03]' : 'bg-white border-transparent shadow-soft hover:border-primary/40'
            )}
          >
            <span className="font-poppins text-2xl font-bold block">{l}</span>
            <span className={cn('text-xs', level === l ? 'text-white/80' : 'text-muted-foreground')}>{t('home.types.count', { count: counts[l] ?? 0 })}</span>
            <span aria-hidden className={cn('mt-2 h-1.5 rounded-full block', level === l ? 'bg-white/70' : 'bg-primary/20')} style={{ width: `${((i + 1) / 6) * 100}%` }} />
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={level}
          initial={reduce ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -16 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-2xl shadow-soft p-6 md:p-8 flex flex-col"
        >
          <p className="font-poppins text-sm font-semibold text-primary">{t(`enums.level.${level}`)}</p>
          <p className="mt-4 text-sm font-semibold text-dark-gray">{t('home.levels.canDo')}</p>
          <p className="text-lg text-dark-gray mt-1">{t(`home.levels.${level}.can`)}</p>
          <p className="mt-5 text-sm font-semibold text-dark-gray">{t('home.levels.typical')}</p>
          <p className="text-muted-foreground mt-1">{t(`home.levels.${level}.goal`)}</p>
          <Link href={`/courses?level=${level}`} className="mt-auto pt-6 inline-flex items-center gap-2 text-primary font-medium hover:underline">
            {t('home.levels.show', { level })} <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  const reduce = useReducedMotion()
  return (
    <div className="divide-y divide-border bg-white rounded-2xl shadow-soft">
      {items.map((item, i) => (
        <div key={i}>
          <button
            className="w-full flex items-center justify-between gap-4 text-start px-6 py-5 font-medium text-dark-gray hover:text-primary"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          >
            {item.q}
            <ChevronDown className={cn('w-5 h-5 shrink-0 transition-transform', open === i && 'rotate-180')} />
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                initial={reduce ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={reduce ? undefined : { height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <p className="px-6 pb-5 text-muted-foreground">{item.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
