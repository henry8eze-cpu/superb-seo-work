'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, CalendarDays, MapPin, Search } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'

const WORDS = ['intensive', 'evening', 'exam', 'online', 'integration'] as const

export type HeroCourse = {
  id: string
  name: string
  school: string
  start: string
  place: string
  price: string
  mode: 'INSTANT' | 'ENQUIRY' | 'UNAVAILABLE'
}

export function Hero({
  cities,
  popularCities,
  preview,
}: {
  cities: string[]
  popularCities: string[]
  preview: HeroCourse[]
}) {
  const { t } = useLanguage()
  const reduce = useReducedMotion()
  const [word, setWord] = useState(0)

  useEffect(() => {
    if (reduce) return
    const timer = setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2400)
    return () => clearInterval(timer)
  }, [reduce])

  return (
    <section className="relative overflow-hidden">
      {/* Soft brand shapes */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -end-24 w-[28rem] h-[28rem] rounded-full bg-secondary/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-40 -start-32 w-[24rem] h-[24rem] rounded-full bg-primary/15 blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 sm:pt-12 sm:pb-16 md:pt-20 md:pb-24 laptop:pt-8 laptop:pb-14 grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
        <div>
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white shadow-soft text-primary px-4 py-1.5 rounded-full text-sm font-medium font-poppins"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {t('home.hero.kicker')}
          </motion.span>

          <h1 className="mt-4 sm:mt-6 laptop:mt-4 text-[2.15rem] sm:text-5xl lg:text-[3.4rem] laptop:text-[2.6rem] font-poppins font-bold text-dark-gray leading-[1.1]">
            {t('home.hero.titleStart')}{' '}
            {/* Own line, never wraps, so the heading doesn't jump as the word changes. */}
            <span className="relative block text-primary whitespace-nowrap h-[1.15em]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={WORDS[word]}
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -18 }}
                  transition={{ duration: 0.35 }}
                  className="inline-block"
                >
                  {t(`home.hero.rotating.${WORDS[word]}`)}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="text-dark-gray/90">{t('home.hero.titleEnd')}</span>
          </h1>

          <p className="text-base sm:text-lg laptop:text-base text-muted-foreground mt-4 sm:mt-6 laptop:mt-4 max-w-xl">{t('home.hero.subtitle')}</p>

          <form action="/courses" method="get" className="mt-6 sm:mt-8 laptop:mt-6 bg-white rounded-2xl shadow-premium p-2 flex flex-col sm:flex-row gap-2">
            <label className="flex items-center gap-2 flex-1 px-3">
              <MapPin className="w-5 h-5 text-primary shrink-0" />
              <input
                name="city"
                list="home-cities"
                placeholder={t('market.home.cityPlaceholder')}
                aria-label={t('market.home.cityPlaceholder')}
                className="w-full py-3 text-base bg-transparent focus:outline-none"
              />
              <datalist id="home-cities">
                {cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <select name="level" aria-label={t('market.search.level')} className="sm:w-40 px-3 py-3 rounded-xl bg-cream text-base focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">{t('market.home.anyLevel')}</option>
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <button className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-[#E05530] transition-colors">
              <Search className="w-5 h-5" />
              {t('market.home.searchButton')}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('home.hero.popularCities')}</span>
            {popularCities.map((city) => (
              <Link
                key={city}
                href={`/courses?city=${encodeURIComponent(city)}`}
                className="px-3 py-1 rounded-full bg-white border border-border hover:border-primary hover:text-primary transition-colors"
              >
                {city}
              </Link>
            ))}
            <Link href="/courses?format=ONLINE" className="px-3 py-1 rounded-full bg-white border border-border hover:border-primary hover:text-primary transition-colors">
              {t('home.hero.online')}
            </Link>
          </div>

        </div>

        {/* Live course previews */}
        <div className="relative hidden lg:flex flex-col gap-5 py-4 laptop:gap-3 laptop:py-0">
          {preview.slice(0, 3).map((course, i) => (
            <motion.div
              key={course.id}
              initial={reduce ? false : { opacity: 0, y: 30, rotate: 0 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: [0, -6, 0] }}
              transition={{
                opacity: { delay: 0.2 + i * 0.15, duration: 0.5 },
                y: { duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 },
              }}
              className="w-[22rem] max-w-full bg-white rounded-2xl shadow-premium p-5 laptop:p-4"
              style={{ marginLeft: `${[3, 0, 5][i]}rem` }}
            >
              <Link href={`/courses/${course.id}`} className="block group">
                <span
                  className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    course.mode === 'INSTANT' ? 'bg-green-600 text-white' : 'bg-blue-100 text-blue-900'
                  }`}
                >
                  {t(`enums.mode.${course.mode}`)}
                </span>
                <p className="font-poppins font-bold text-dark-gray mt-2 leading-snug group-hover:text-primary transition-colors">{course.name}</p>
                <p className="text-sm text-muted-foreground">{course.school}</p>
                <div className="flex items-center justify-between mt-3 text-sm">
                  <span className="flex items-center gap-1.5 text-dark-gray">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    {course.start}
                  </span>
                  <span className="font-bold">{course.price}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {course.place}
                  <ArrowRight className="w-3 h-3 ms-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
