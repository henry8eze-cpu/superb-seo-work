import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { formatDate, formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { approveCourseAction, rejectCourseAction } from '@/app/actions/admin-marketplace'
import { ActionButton, ActionForm } from '@/components/app/action-form'
import { Card, EmptyState, inputClass, PageHeader, StatusBadge } from '@/components/app/ui'

export const metadata = { title: 'Approvals | Admin' }

export default async function ApprovalsPage() {
  await requireAdmin()
  const { t, locale } = await getT()
  const pending = await prisma.courseType.findMany({
    where: { publicationStatus: 'PENDING_APPROVAL' },
    orderBy: { submittedAt: 'asc' },
    include: {
      school: { select: { name: true, status: true } },
      branch: true,
      language: true,
      intakes: { where: { archivedAt: null }, orderBy: { startDate: 'asc' }, include: { fees: true } },
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.approvals.title')} description={t('admin.approvals.subtitle')} />
      {pending.length === 0 && (
        <Card>
          <EmptyState>{t('common.noResults')}</EmptyState>
        </Card>
      )}
      {pending.map((course) => (
        <Card
          key={course.id}
          title={
            <span>
              {course.name} <span className="text-sm font-normal text-muted-foreground">· {course.school.name}</span>
            </span>
          }
          actions={<StatusBadge status={course.school.status} label={t(`enums.schoolStatus.${course.school.status}`)} />}
        >
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="text-sm space-y-2">
              <p>
                {course.language.nameDe} · {course.level} · {t(`enums.category.${course.category}`)} · {t(`enums.format.${course.format}`)} ·{' '}
                {t('common.perWeek', { count: course.lessonsPerWeek })} × {course.lessonMinutes} min
              </p>
              <p className="text-muted-foreground">
                {course.branch.isOnline ? t('common.online') : [course.branch.address, course.branch.postcode, course.branch.cityName].filter(Boolean).join(', ')}
              </p>
              {course.description && <p className="whitespace-pre-wrap">{course.description}</p>}
              <p>
                <span className="font-medium">{t('emails.bookingConfirmed.cancellation')}:</span> <span className="whitespace-pre-wrap">{course.cancellationTerms}</span>
              </p>
              <p className="text-xs text-muted-foreground">{t('admin.approvals.submitted', { date: formatDate(course.submittedAt, locale) })}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">{t('admin.approvals.intakes')}</h4>
              <ul className="text-sm divide-y divide-border">
                {course.intakes.map((intake) => (
                  <li key={intake.id} className="py-2">
                    {formatDay(intake.startDate, locale)} – {formatDay(intake.endDate, locale)} · {intake.startTime}–{intake.endTime} ·{' '}
                    {intake.weekdays.map((d) => t(`weekdays.short.${d}`)).join(', ')} · {formatMoney(intake.totalPriceCents, intake.currency, locale)} · {t('common.capacityCount', { count: intake.capacity })}
                    {intake.fees.length > 0 && <span className="text-xs text-muted-foreground"> ({intake.fees.map((f) => `${f.label} ${formatMoney(f.amountCents, intake.currency, locale)}`).join(', ')})</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 mt-6 md:items-end">
            <ActionButton action={approveCourseAction.bind(null, course.id)} variant="primary" successMessage={t('admin.approvals.approved')}>
              {t('admin.approvals.approve')}
            </ActionButton>
            <ActionForm action={rejectCourseAction.bind(null, course.id)} submitLabel={t('admin.approvals.reject')} variant="danger" successMessage={t('admin.approvals.rejected')} className="flex-1 flex gap-2 items-start space-y-0">
              <input name="reason" required placeholder={t('admin.approvals.rejectReason')} className={inputClass} />
            </ActionForm>
          </div>
        </Card>
      ))}
    </div>
  )
}
