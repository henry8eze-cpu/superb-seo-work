import { getT } from '@/lib/i18n/server'
import { formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { getDirectorySchoolsCached, getLandingDataCached } from '@/lib/services/landing'
import { supportRequestAction } from '@/app/actions/marketplace'
import { SiteFooter, SiteHeader } from '@/components/market/site-header'
import { CourseCard } from '@/components/market/course-card'
import { ActionForm } from '@/components/app/action-form'
import { Field, inputClass } from '@/components/app/ui'
import { Hero } from '@/components/home/hero'
import { CourseTabs, Faq, LevelGuide } from '@/components/home/interactive'
import { CityGrid, CourseTypes, ForSchoolsBand, HowItWorks, MoreLink, SchoolCards, SectionTitle } from '@/components/home/sections'
import { Reveal } from '@/components/home/motion'

export default async function Home() {
  const [{ t, locale }, data, schools] = await Promise.all([getT(), getLandingDataCached(), getDirectorySchoolsCached(null, 6)])

  const preview = data.tabs.all.slice(0, 3).map((r) => ({
    id: r.intakeId,
    name: r.intake.courseType.name,
    school: r.intake.school.name,
    start: formatDay(r.intake.startDate, locale),
    place: r.intake.courseType.format === 'ONLINE' || r.intake.courseType.branch.isOnline ? t('common.online') : r.intake.courseType.branch.cityName ?? '',
    price: formatMoney(r.intake.totalPriceCents, r.intake.currency, locale),
    mode: r.mode,
  }))

  const panel = (list: typeof data.tabs.all) =>
    list.length === 0 ? (
      <p className="bg-white rounded-2xl p-10 text-center text-muted-foreground">{t('home.upcoming.empty')}</p>
    ) : (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {list.map((result) => (
          <CourseCard key={result.intakeId} result={result} t={t} locale={locale} />
        ))}
      </div>
    )

  const tabs = [
    { key: 'all', label: t('home.upcoming.all'), list: data.tabs.all },
    { key: 'instant', label: t('home.upcoming.instant'), list: data.tabs.instant },
    { key: 'evening', label: t('home.upcoming.evening'), list: data.tabs.evening },
    { key: 'online', label: t('home.upcoming.online'), list: data.tabs.online },
  ]
    .filter((tab) => tab.key === 'all' || tab.list.length > 0)
    .map((tab) => ({ key: tab.key, label: tab.label, count: tab.list.length, panel: panel(tab.list) }))

  const popularCities = data.cityStats
    .filter((c) => c.courses > 0)
    .sort((a, b) => b.courses - a.courses)
    .slice(0, 5)
    .map((c) => c.name)

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <SiteHeader />
      <main className="flex-1">
        <Hero
          cities={data.cityStats.map((c) => c.name)}
          popularCities={popularCities.length ? popularCities : data.cityStats.slice(0, 5).map((c) => c.name)}
          preview={preview}
        />

        <section className="py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle title={t('home.upcoming.title')} action={<MoreLink href="/courses" label={t('market.home.viewAll')} />} />
            <CourseTabs tabs={tabs} />
          </div>
        </section>

        <HowItWorks t={t} />
        <CityGrid cities={data.cityStats} t={t} locale={locale} />
        <CourseTypes t={t} counts={data.categoryCounts} onlineCount={data.onlineCount} />

        <section className="py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle title={t('home.levels.title')} subtitle={t('home.levels.subtitle')} />
            <LevelGuide counts={data.levelCounts} />
          </div>
        </section>

        {schools.length > 0 && (
          <section className="py-16 md:py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <SectionTitle title={t('home.schools.title')} subtitle={t('home.schools.subtitle')} action={<MoreLink href="/schools" label={t('home.schools.viewAll')} />} />
              <SchoolCards schools={schools} t={t} locale={locale} />
            </div>
          </section>
        )}

        <section className="py-16 md:py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-3xl md:text-4xl font-poppins font-bold text-dark-gray mb-8 text-center">{t('home.faq.title')}</h2>
            </Reveal>
            <Faq items={[1, 2, 3, 4, 5].map((n) => ({ q: t(`home.faq.q${n}`), a: t(`home.faq.a${n}`) }))} />
          </div>
        </section>

        <ForSchoolsBand
          t={t}
          form={
            <ActionForm action={supportRequestAction} submitLabel={t('home.forSchools.send')} successMessage={t('home.forSchools.sent')} resetOnSuccess>
              <input type="hidden" name="type" value="SCHOOL_DATA" />
              <Field label={t('home.forSchools.schoolName')}>
                <input name="subject" required minLength={3} className={inputClass} />
              </Field>
              <Field label={t('common.email')}>
                <input name="email" type="email" required className={inputClass} />
              </Field>
              <Field label={t('common.message')}>
                <textarea name="message" rows={3} required minLength={10} placeholder={t('home.forSchools.message')} className={inputClass} />
              </Field>
              <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            </ActionForm>
          }
        />
      </main>
      <SiteFooter />
    </div>
  )
}
