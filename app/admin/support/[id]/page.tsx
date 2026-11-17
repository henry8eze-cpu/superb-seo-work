import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { formatDateTime } from '@/lib/dates'
import { updateSupportAction } from '@/app/actions/admin-marketplace'
import { ActionForm } from '@/components/app/action-form'
import { Card, DefinitionList, Field, inputClass, PageHeader, StatusBadge } from '@/components/app/ui'

export const metadata = { title: 'Support request | Admin' }

export default async function SupportRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const { t, locale } = await getT()
  const request = await prisma.supportRequest.findUnique({
    where: { id },
    include: { booking: { select: { id: true, reference: true } }, school: { select: { id: true, name: true } }, assignee: { select: { name: true } } },
  })
  if (!request) notFound()

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        back={{ href: '/admin/support', label: t('admin.support.title') }}
        title={request.subject}
        description={<StatusBadge status={request.status} label={t(`enums.supportStatus.${request.status}`)} />}
      />
      <Card>
        <DefinitionList
          items={[
            [t('common.status'), t(`enums.supportType.${request.type}`)],
            [t('common.email'), request.email],
            [t('common.date'), formatDateTime(request.createdAt, locale)],
            [t('admin.bookings.school'), request.school ? <Link key="s" className="text-primary underline" href={`/admin/schools/${request.school.id}`}>{request.school.name}</Link> : null],
            [t('admin.support.relatedBooking'), request.booking ? <Link key="b" className="text-primary underline" href={`/admin/bookings/${request.booking.id}`}>{request.booking.reference}</Link> : null],
            [t('admin.support.assignee'), request.assignee?.name],
          ]}
        />
        <p className="mt-4 whitespace-pre-wrap text-sm bg-cream rounded-lg p-4">{request.message}</p>
      </Card>
      <Card title={t('admin.support.update')}>
        <ActionForm action={updateSupportAction.bind(null, request.id)} submitLabel={t('admin.support.update')} successMessage={t('common.saved')}>
          <Field label={t('common.status')}>
            <select name="status" defaultValue={request.status} className={inputClass}>
              {(['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`enums.supportStatus.${s}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin.support.resolution')}>
            <textarea name="resolution" rows={4} defaultValue={request.resolution ?? ''} className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="assignToMe" /> {t('admin.support.assignToMe')}
          </label>
        </ActionForm>
      </Card>
    </div>
  )
}
