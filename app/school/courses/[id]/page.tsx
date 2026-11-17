import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSchoolActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDay, formatDateTime } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { getAvailability } from '@/lib/booking/inventory'
import { archiveCourseAction, createIntakeAction, submitCourseAction, updateCourseAction } from '@/app/actions/school'
import { ActionButton, ActionForm } from '@/components/app/action-form'
import { Card, PageHeader, StatusBadge, Table, Td } from '@/components/app/ui'
import { CourseFields } from '@/components/school/course-fields'
import { IntakeForm } from '@/components/school/intake-form'

export const metadata = { title: 'Course | School app' }

export default async function SchoolCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSchoolActor()
  const { id } = await params
  const { t, locale } = await getT()
  const course = await prisma.courseType.findUnique({
    where: { id },
    include: { intakes: { where: { archivedAt: null }, orderBy: { startDate: 'asc' } } },
  })
  if (!course || course.schoolId !== actor.schoolId) notFound()

  const [branches, languages, availability] = await Promise.all([
    prisma.branch.findMany({ where: { schoolId: actor.schoolId, archivedAt: null }, orderBy: { name: 'asc' } }),
    prisma.language.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    getAvailability(course.intakes.map((i) => i.id)),
  ])
  const canEdit = actor.permissions.manageCourses && course.publicationStatus !== 'ARCHIVED'
  const canSubmit = canEdit && (course.publicationStatus === 'DRAFT' || course.publicationStatus === 'REJECTED')

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/school/courses', label: t('school.courses.title') }}
        title={course.name}
        description={<StatusBadge status={course.publicationStatus} label={t(`enums.publication.${course.publicationStatus}`)} />}
        actions={
          canEdit && (
            <ActionButton action={archiveCourseAction.bind(null, course.id)} variant="danger" confirmMessage={`${t('school.courses.archiveHint')} ${t('common.areYouSure')}`} successMessage={t('common.saved')}>
              {t('school.courses.archive')}
            </ActionButton>
          )
        }
      />

      {course.publicationStatus === 'REJECTED' && course.rejectionReason && (
        <p className="bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">{t('school.courses.rejectedBecause', { reason: course.rejectionReason })}</p>
      )}
      {canSubmit && (
        <div className="bg-white rounded-lg shadow-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t('school.courses.submitHint')}</p>
          <ActionButton action={submitCourseAction.bind(null, course.id)} variant="primary" successMessage={t('school.courses.submitted')}>
            {t('school.courses.submit')}
          </ActionButton>
        </div>
      )}

      <Card title={t('school.courses.intakes')}>
        <Table
          head={[t('common.from'), t('common.to'), t('school.intake.weekdays'), t('common.total'), t('school.dashboard.sold'), t('school.dashboard.available'), t('common.status'), t('common.lastConfirmedShort')]}
          empty={t('school.courses.noIntakes')}
        >
          {course.intakes.map((intake) => {
            const seats = availability.get(intake.id)
            return (
              <tr key={intake.id} className="hover:bg-cream">
                <Td className="whitespace-nowrap">
                  <Link href={`/school/intakes/${intake.id}`} className="font-medium hover:text-primary">
                    {formatDay(intake.startDate, locale)}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap">{formatDay(intake.endDate, locale)}</Td>
                <Td className="whitespace-nowrap">
                  {intake.weekdays.map((d) => t(`weekdays.short.${d}`)).join(', ')} · {intake.startTime}–{intake.endTime}
                </Td>
                <Td className="whitespace-nowrap">{formatMoney(intake.totalPriceCents, intake.currency, locale)}</Td>
                <Td>
                  {seats?.confirmed ?? 0}/{intake.capacity}
                </Td>
                <Td>{seats?.available ?? intake.capacity}</Td>
                <Td>
                  <StatusBadge status={intake.status} label={t(`enums.intakeStatus.${intake.status}`)} />
                </Td>
                <Td className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(intake.lastConfirmedAt, locale)}</Td>
              </tr>
            )
          })}
        </Table>
      </Card>

      <div className="grid xl:grid-cols-2 gap-6 items-start">
        {canEdit && (
          <Card title={t('school.courses.newIntake')}>
            <IntakeForm action={createIntakeAction.bind(null, course.id)} submitLabel={t('common.create')} successMessage={t('school.intake.created')} />
          </Card>
        )}
        <Card title={t('admin.school.details')}>
          <ActionForm action={updateCourseAction.bind(null, course.id)} submitLabel={t('common.save')} successMessage={t('common.saved')}>
            <CourseFields t={t} locale={locale} branches={branches} languages={languages} course={course} disabled={!canEdit} />
          </ActionForm>
        </Card>
      </div>
    </div>
  )
}
