import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireSchoolActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDay } from '@/lib/dates'
import { getAvailability } from '@/lib/booking/inventory'
import { buttonClass, Card, EmptyState, PageHeader, StatusBadge } from '@/components/app/ui'

export const metadata = { title: 'Courses | School app' }

export default async function SchoolCoursesPage() {
  const actor = await requireSchoolActor()
  const { t, locale } = await getT()
  const now = new Date()
  const courses = await prisma.courseType.findMany({
    where: { schoolId: actor.schoolId, publicationStatus: { not: 'ARCHIVED' } },
    orderBy: { createdAt: 'desc' },
    include: {
      branch: { select: { name: true } },
      intakes: { where: { archivedAt: null, endDate: { gte: now } }, orderBy: { startDate: 'asc' } },
    },
  })
  const availability = await getAvailability(courses.flatMap((c) => c.intakes.map((i) => i.id)))

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('school.courses.title')}
        description={t('school.courses.subtitle')}
        actions={
          actor.permissions.manageCourses && (
            <Link href="/school/courses/new" className={buttonClass}>
              {t('school.courses.new')}
            </Link>
          )
        }
      />
      {courses.length === 0 && (
        <Card>
          <EmptyState>{t('common.noResults')}</EmptyState>
        </Card>
      )}
      <div className="grid lg:grid-cols-2 gap-6">
        {courses.map((course) => (
          <Card
            key={course.id}
            title={
              <Link href={`/school/courses/${course.id}`} className="hover:text-primary">
                {course.name}
              </Link>
            }
            actions={<StatusBadge status={course.publicationStatus} label={t(`enums.publication.${course.publicationStatus}`)} />}
          >
            <p className="text-sm text-muted-foreground mb-3">
              {course.level} · {t(`enums.category.${course.category}`)} · {t(`enums.format.${course.format}`)} · {course.branch.name}
            </p>
            {course.intakes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('school.courses.noIntakes')}</p>
            ) : (
              <ul className="text-sm divide-y divide-border">
                {course.intakes.map((intake) => {
                  const seats = availability.get(intake.id)
                  return (
                    <li key={intake.id}>
                      <Link href={`/school/intakes/${intake.id}`} className="py-2 flex items-center justify-between gap-2 hover:text-primary">
                        <span>
                          {formatDay(intake.startDate, locale)} · {intake.startTime}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs">
                            {seats?.confirmed ?? 0}/{intake.capacity}
                          </span>
                          <StatusBadge status={intake.status} label={t(`enums.intakeStatus.${intake.status}`)} />
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
