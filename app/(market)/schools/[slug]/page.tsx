import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { BadgeCheck, Globe, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { formatDate, formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { getPublicSchoolCached } from '@/lib/services/landing'
import { ModeBadge } from '@/components/market/course-card'
import { Reveal } from '@/components/home/motion'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await getPublicSchoolCached((await params).slug)
  if (!data) return {}
  return { title: `${data.school.name} – Deutschkurse`, description: data.school.description?.slice(0, 160) }
}

export default async function SchoolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [{ t, locale }, data] = await Promise.all([getT(), getPublicSchoolCached(slug)])
  if (!data) notFound()
  const { school, intakes } = data
  const instant = school.status === 'PARTNER' && school.instantBookingEnabled
  const physical = school.branches.filter((b) => !b.isOnline)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/schools" className="text-sm text-muted-foreground hover:text-primary">
        ← {t('home.schools.directoryTitle')}
      </Link>

      <header className="mt-4 bg-white rounded-2xl shadow-soft p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
        <span className="w-16 h-16 rounded-2xl bg-primary text-white font-poppins text-2xl font-bold flex items-center justify-center shrink-0">
          {school.name
            .replace(/[^A-Za-zÄÖÜäöü ]/g, '')
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0])
            .join('')
            .toUpperCase()}
        </span>
        <div className="flex-1">
          <h1 className="font-poppins text-2xl md:text-3xl font-bold text-dark-gray">{school.name}</h1>
          <p className="text-muted-foreground">
            {t(`enums.schoolType.${school.schoolType}`)}
            {school.city && ` · ${school.city.name}`}
          </p>
          <span
            className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${instant ? 'bg-green-100 text-green-800' : 'bg-blue-50 text-blue-900'}`}
          >
            {instant ? <BadgeCheck className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
            {instant ? t('home.schools.partner') : t('home.schools.listed')}
          </span>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_20rem] gap-8 mt-8 items-start">
        <div className="space-y-8">
          {school.description && (
            <Reveal>
              <section className="bg-white rounded-2xl shadow-soft p-6">
                <h2 className="font-poppins font-bold text-lg mb-2">{t('home.schools.about')}</h2>
                <p className="whitespace-pre-wrap text-dark-gray">{school.description}</p>
              </section>
            </Reveal>
          )}

          <section>
            <h2 className="font-poppins font-bold text-2xl mb-4">{t('home.schools.upcomingCourses')}</h2>
            {intakes.length === 0 ? (
              <p className="bg-white rounded-2xl p-8 text-center text-muted-foreground">{t('home.schools.noCourses')}</p>
            ) : (
              <ul className="space-y-3">
                {intakes.map(({ intake, mode, reason }, i) => (
                  <Reveal key={intake.id} delay={Math.min(i, 6) * 0.04}>
                    <li>
                      <Link href={`/courses/${intake.id}`} className="group bg-white rounded-2xl shadow-soft p-5 hover:shadow-premium transition-shadow flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="sm:w-28 shrink-0">
                          <p className="font-poppins font-bold text-dark-gray">{formatDay(intake.startDate, locale)}</p>
                          <p className="text-xs text-muted-foreground">
                            {intake.startTime}–{intake.endTime}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-dark-gray group-hover:text-primary transition-colors">{intake.courseType.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {intake.courseType.level} · {t(`enums.category.${intake.courseType.category}`)} ·{' '}
                            {intake.courseType.format === 'ONLINE' || intake.courseType.branch.isOnline ? t('common.online') : intake.courseType.branch.cityName}
                          </p>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end gap-2 justify-between">
                          <span className="font-poppins font-bold">{formatMoney(intake.totalPriceCents, intake.currency, locale)}</span>
                          <ModeBadge mode={mode} reason={reason} t={t} />
                        </div>
                      </Link>
                    </li>
                  </Reveal>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20">
          <section className="bg-white rounded-2xl shadow-soft p-6 space-y-3 text-sm">
            <h2 className="font-poppins font-bold text-lg">{t('home.schools.contact')}</h2>
            {school.website && (
              <a href={school.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline break-all">
                <Globe className="w-4 h-4 shrink-0" />
                {school.websiteDomain ?? school.website}
              </a>
            )}
            {school.phone && (
              <a href={`tel:${school.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 hover:text-primary">
                <Phone className="w-4 h-4 shrink-0" />
                {school.phone}
              </a>
            )}
            {school.publicEmail && (
              <a href={`mailto:${school.publicEmail}`} className="flex items-center gap-2 hover:text-primary break-all">
                <Mail className="w-4 h-4 shrink-0" />
                {school.publicEmail}
              </a>
            )}
          </section>

          {physical.length > 0 && (
            <section className="bg-white rounded-2xl shadow-soft p-6 text-sm">
              <h2 className="font-poppins font-bold text-lg mb-3">{t('home.schools.locations')}</h2>
              <ul className="space-y-3">
                {physical.map((b) => (
                  <li key={b.id} className="flex gap-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>
                      <span className="font-medium">{b.name}</span>
                      <br />
                      {b.address}
                      {b.address && <br />}
                      {b.postcode} {b.cityName}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {school.courseTypesOffered.length > 0 && (
            <section className="bg-white rounded-2xl shadow-soft p-6 text-sm">
              <h2 className="font-poppins font-bold text-lg mb-3">{t('home.schools.offers')}</h2>
              <div className="flex flex-wrap gap-1.5">
                {school.courseTypesOffered.map((c) => (
                  <span key={c} className="bg-cream rounded-full px-3 py-1">
                    {t(`enums.category.${c}`)}
                  </span>
                ))}
              </div>
            </section>
          )}

          {school.status !== 'PARTNER' && (
            <section className="rounded-2xl border border-dashed border-border p-6 text-sm">
              <p className="font-semibold">{t('home.schools.isThisYours')}</p>
              <p className="text-muted-foreground mt-1">{t('home.schools.isThisYoursText')}</p>
              <Link href="/#for-schools" className="text-primary font-medium mt-2 inline-block hover:underline">
                {t('home.forSchools.formTitle')} →
              </Link>
            </section>
          )}

          {school.lastCheckedAt && <p className="text-xs text-muted-foreground px-1">{t('home.schools.source', { date: formatDate(school.lastCheckedAt, locale) })}</p>}
        </aside>
      </div>
    </div>
  )
}
