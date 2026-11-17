import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { searchCourses } from '@/lib/services/search'
import { CourseCard } from './course-card'
import { buttonClass } from '@/components/app/ui'

/** Real, bookable course dates starting soon. Optionally limited to one school. */
export async function UpcomingCourses({ schoolId, limit = 6 }: { schoolId?: string; limit?: number }) {
  const { t, locale } = await getT()
  const { results } = await searchCourses({ availableOnly: true, sort: 'start' })
  const shown = results.filter((r) => !schoolId || r.intake.school.id === schoolId).slice(0, limit)

  return (
    <section id="courses" className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-dark-gray">{t('market.home.upcoming')}</h2>
          <Link href="/courses" className="text-primary font-medium hover:underline">
            {t('market.home.viewAll')} →
          </Link>
        </div>
        {shown.length === 0 ? (
          <div className="bg-white rounded-lg shadow-soft p-10 text-center">
            <Link href="/courses" className={buttonClass}>
              {t('market.home.viewAll')}
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shown.map((result) => (
              <CourseCard key={result.intakeId} result={result} t={t} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
