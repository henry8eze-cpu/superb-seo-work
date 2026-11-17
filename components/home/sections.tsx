// Server-rendered landing page sections.

import Link from 'next/link'
import { ArrowRight, BadgeCheck, Ban, BookOpen, Building2, CalendarClock, CheckCircle2, GraduationCap, Laptop, MessageCircle, Moon, Search, Scale, Sun, Users, Zap } from 'lucide-react'
import type { Translate } from '@/lib/i18n'
import type { CityStat, DirectorySchool } from '@/lib/services/landing'
import { formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Reveal, CountUp } from './motion'

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h2 className="text-3xl md:text-4xl font-poppins font-bold text-dark-gray">{title}</h2>
        {subtitle && <p className="text-muted-foreground mt-2 max-w-2xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function HowItWorks({ t }: { t: Translate }) {
  const steps = [
    { icon: Search, title: t('home.how.step1'), text: t('home.how.step1Text') },
    { icon: Scale, title: t('home.how.step2'), text: t('home.how.step2Text') },
    { icon: CalendarClock, title: t('home.how.step3'), text: t('home.how.step3Text') },
  ]
  const labels = [
    { icon: Zap, label: t('enums.mode.INSTANT'), text: t('home.how.instant'), cls: 'bg-green-600 text-white' },
    { icon: MessageCircle, label: t('enums.mode.ENQUIRY'), text: t('home.how.enquiry'), cls: 'bg-blue-100 text-blue-900' },
    { icon: Ban, label: t('enums.mode.UNAVAILABLE'), text: t('home.how.unavailable'), cls: 'bg-gray-200 text-gray-700' },
  ]
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle title={t('home.how.title')} subtitle={t('home.how.subtitle')} />
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.1}>
              <div className="relative h-full rounded-2xl bg-cream p-6">
                <span className="absolute top-5 end-6 font-poppins text-5xl font-bold text-primary/10">{i + 1}</span>
                <span className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center">
                  <step.icon className="w-6 h-6" />
                </span>
                <h3 className="font-poppins text-xl font-bold mt-4">{step.title}</h3>
                <p className="text-muted-foreground mt-2">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2}>
          <div className="mt-10 rounded-2xl border border-border p-6">
            <h3 className="font-poppins font-bold mb-4">{t('home.how.labelsTitle')}</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {labels.map((l) => (
                <div key={l.label} className="flex gap-3 items-start">
                  <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0', l.cls)}>
                    <l.icon className="w-3.5 h-3.5" />
                    {l.label}
                  </span>
                  <p className="text-sm text-muted-foreground">{l.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function CityGrid({ cities, t, locale }: { cities: CityStat[]; t: Translate; locale: string }) {
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle title={t('home.cities.title')} subtitle={t('home.cities.subtitle')} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cities.map((city, i) => {
            const active = city.courses > 0 || city.schools > 0
            return (
              <Reveal key={city.slug} delay={Math.min(i, 8) * 0.04}>
                <Link
                  href={active ? `/courses?city=${encodeURIComponent(city.name)}` : '/courses'}
                  className={cn(
                    'group block h-full rounded-2xl p-5 transition-all',
                    active ? 'bg-white shadow-soft hover:shadow-premium hover:-translate-y-1' : 'bg-white/50 border border-dashed border-border'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-poppins font-bold text-lg text-dark-gray group-hover:text-primary transition-colors">{city.name}</h3>
                    <Building2 className={cn('w-5 h-5', active ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  {active ? (
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="text-dark-gray font-medium">
                        <CountUp value={city.courses} /> {t('home.cities.coursesLabel')}
                      </p>
                      <p className="text-muted-foreground">{t('home.cities.schools', { count: city.schools })}</p>
                      {city.minPriceCents !== null && <p className="text-green-700 font-medium">{t('home.cities.from', { price: formatMoney(city.minPriceCents, 'EUR', locale) })}</p>}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">{t('home.cities.comingSoon')}</p>
                  )}
                </Link>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const TYPE_TILES = [
  { key: 'INTENSIVE', icon: Sun, href: '/courses?category=INTENSIVE' },
  { key: 'EVENING', icon: Moon, href: '/courses?time=evening' },
  { key: 'EXAM_PREP', icon: GraduationCap, href: '/courses?category=EXAM_PREP' },
  { key: 'INTEGRATION', icon: Users, href: '/courses?category=INTEGRATION' },
  { key: 'WEEKEND', icon: BookOpen, href: '/courses?category=WEEKEND' },
  { key: 'ONLINE', icon: Laptop, href: '/courses?format=ONLINE' },
] as const

export function CourseTypes({ t, counts, onlineCount }: { t: Translate; counts: Partial<Record<string, number>>; onlineCount: number }) {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle title={t('home.types.title')} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TYPE_TILES.map((tile, i) => {
            const count = tile.key === 'ONLINE' ? onlineCount : counts[tile.key] ?? 0
            return (
              <Reveal key={tile.key} delay={i * 0.05}>
                <Link href={tile.href} className="group flex gap-4 items-start rounded-2xl bg-cream p-5 hover:bg-primary hover:text-white transition-colors h-full">
                  <span className="w-11 h-11 rounded-xl bg-white text-primary flex items-center justify-center shrink-0 group-hover:bg-white/20 group-hover:text-white transition-colors">
                    <tile.icon className="w-5 h-5" />
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-poppins font-bold">{tile.key === 'ONLINE' ? t('enums.format.ONLINE') : t(`enums.category.${tile.key}`)}</span>
                      <span className="text-xs opacity-70">{t('home.types.count', { count })}</span>
                    </span>
                    <span className="block text-sm opacity-80 mt-1">{t(`home.types.${tile.key}`)}</span>
                  </span>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function SchoolCards({ schools, t, locale }: { schools: DirectorySchool[]; t: Translate; locale: string }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {schools.map((school, i) => (
        <Reveal key={school.id} delay={Math.min(i, 6) * 0.05}>
          <Link href={`/schools/${school.slug}`} className="group block h-full bg-white rounded-2xl shadow-soft p-5 hover:shadow-premium transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <span className="w-11 h-11 rounded-xl bg-cream text-primary font-poppins font-bold flex items-center justify-center shrink-0">
                {school.name
                  .replace(/[^A-Za-zÄÖÜäöü ]/g, '')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full',
                  school.instant ? 'bg-green-100 text-green-800' : 'bg-blue-50 text-blue-900'
                )}
              >
                {school.instant ? <BadgeCheck className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
                {school.instant ? t('home.schools.partner') : t('home.schools.listed')}
              </span>
            </div>
            <h3 className="font-poppins font-bold text-dark-gray mt-3 group-hover:text-primary transition-colors">{school.name}</h3>
            <p className="text-sm text-muted-foreground">
              {t(`enums.schoolType.${school.schoolType}`)}
              {school.city && ` · ${school.city}`}
            </p>
            <div className="flex flex-wrap gap-1 mt-3">
              {school.courseTypesOffered.slice(0, 3).map((c) => (
                <span key={c} className="text-[11px] bg-cream rounded px-2 py-0.5">
                  {t(`enums.category.${c}`)}
                </span>
              ))}
            </div>
            <p className="text-sm mt-4 pt-3 border-t border-border flex items-center justify-between">
              <span className={school.upcoming ? 'text-dark-gray font-medium' : 'text-muted-foreground'}>
                {school.upcoming ? t('home.schools.courses', { count: school.upcoming }) : t('home.schools.noCourses')}
              </span>
              {school.nextStart && <span className="text-xs text-muted-foreground">{formatDay(school.nextStart, locale)}</span>}
            </p>
          </Link>
        </Reveal>
      ))}
    </div>
  )
}

export function ForSchoolsBand({ t, form }: { t: Translate; form: React.ReactNode }) {
  return (
    <section id="for-schools" className="py-16 md:py-20 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-dark-gray text-white p-8 md:p-12 grid lg:grid-cols-2 gap-10 relative overflow-hidden">
          <div aria-hidden className="absolute -bottom-24 -end-24 w-72 h-72 rounded-full bg-primary/30 blur-3xl" />
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-poppins font-bold">{t('home.forSchools.title')}</h2>
            <p className="text-white/70 mt-4 text-lg">{t('home.forSchools.text')}</p>
            <ul className="mt-6 space-y-3">
              {(['point1', 'point2', 'point3'] as const).map((p) => (
                <li key={p} className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  {t(`home.forSchools.${p}`)}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.15} className="relative">
            <div className="bg-white text-dark-gray rounded-2xl p-6">
              <h3 className="font-poppins font-bold text-lg mb-4">{t('home.forSchools.formTitle')}</h3>
              {form}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-primary font-medium hover:underline whitespace-nowrap">
      {label} <ArrowRight className="w-4 h-4" />
    </Link>
  )
}
