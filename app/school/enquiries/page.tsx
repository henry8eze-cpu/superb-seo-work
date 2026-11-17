import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireSchoolActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDateTime, formatDay } from '@/lib/dates'
import { answerEnquiryAction, closeEnquiryAction } from '@/app/actions/school'
import { ActionButton, ActionForm } from '@/components/app/action-form'
import { Card, EmptyState, inputClass, PageHeader, StatusBadge } from '@/components/app/ui'

export const metadata = { title: 'Enquiries | School app' }

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string; open?: string }> }) {
  const actor = await requireSchoolActor()
  const { t, locale } = await getT()
  const { status } = await searchParams
  const filter = status === 'all' ? {} : { status: 'NEW' as const }
  const enquiries = await prisma.enquiry.findMany({
    where: { schoolId: actor.schoolId, ...filter },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { courseType: { select: { name: true } }, intake: { select: { id: true, startDate: true } }, respondedBy: { select: { name: true } } },
  })
  const canReply = actor.permissions.manageBookings

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={t('school.enquiries.title')} description={t('school.enquiries.subtitle')} />
      <div className="flex gap-2">
        <Link href="/school/enquiries" className={`px-3 py-1.5 rounded-full text-sm ${status !== 'all' ? 'bg-primary text-white' : 'bg-white'}`}>
          {t('enums.enquiryStatus.NEW')}
        </Link>
        <Link href="/school/enquiries?status=all" className={`px-3 py-1.5 rounded-full text-sm ${status === 'all' ? 'bg-primary text-white' : 'bg-white'}`}>
          {t('common.all')}
        </Link>
      </div>
      {enquiries.length === 0 && (
        <Card>
          <EmptyState>{t('common.noResults')}</EmptyState>
        </Card>
      )}
      {enquiries.map((enquiry) => (
        <Card
          key={enquiry.id}
          title={
            <span>
              {enquiry.name} <span className="text-sm font-normal text-muted-foreground">· {enquiry.email}{enquiry.phone && ` · ${enquiry.phone}`}</span>
            </span>
          }
          actions={<StatusBadge status={enquiry.status} label={t(`enums.enquiryStatus.${enquiry.status}`)} />}
        >
          <p className="text-xs text-muted-foreground mb-2">
            {formatDateTime(enquiry.createdAt, locale)} · {enquiry.courseType?.name}
            {enquiry.intake && ` · ${formatDay(enquiry.intake.startDate, locale)}`}
          </p>
          <p className="whitespace-pre-wrap text-sm bg-cream rounded-lg p-3">{enquiry.message}</p>
          {enquiry.response && (
            <div className="mt-3 text-sm">
              <p className="text-xs text-muted-foreground">
                {t('school.enquiries.yourReply')} · {enquiry.respondedBy?.name} ·{' '}
                {enquiry.respondedAt && t('school.enquiries.respondedAfter', { hours: ((enquiry.respondedAt.getTime() - enquiry.createdAt.getTime()) / 3_600_000).toFixed(1) })}
              </p>
              <p className="whitespace-pre-wrap border-s-2 border-primary ps-3 mt-1">{enquiry.response}</p>
            </div>
          )}
          {canReply && enquiry.status !== 'CLOSED' && (
            <div className="mt-4 space-y-2">
              <ActionForm action={answerEnquiryAction.bind(null, enquiry.id)} submitLabel={t('school.enquiries.reply')} successMessage={t('school.enquiries.replied')} resetOnSuccess>
                <textarea name="response" rows={3} required placeholder={t('school.enquiries.replyPlaceholder')} className={inputClass} />
              </ActionForm>
              <ActionButton action={closeEnquiryAction.bind(null, enquiry.id)} className="px-3 py-1 text-xs">
                {t('school.enquiries.close')}
              </ActionButton>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
