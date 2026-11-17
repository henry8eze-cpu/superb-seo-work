import { notFound } from 'next/navigation'
import { requireAdmin } from '@/app/actions/auth'
import { getT } from '@/lib/i18n/server'
import { centsToInput } from '@/lib/money'
import { paymentSummary } from '@/lib/booking/manage'
import { adminCancelBookingAction, retryRefundAction } from '@/app/actions/admin-marketplace'
import { ActionButton, ActionForm } from '@/components/app/action-form'
import { BookingDetail, loadBookingDetail } from '@/components/app/booking-detail'
import { Card, Field, inputClass, PageHeader } from '@/components/app/ui'

export const metadata = { title: 'Booking | Admin' }

export default async function AdminBookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const { t, locale } = await getT()
  const booking = await loadBookingDetail(id)
  if (!booking) notFound()
  const { paid } = paymentSummary(booking)
  const failedRefunds = booking.refunds.filter((r) => r.status !== 'SUCCEEDED')

  return (
    <div>
      <PageHeader back={{ href: '/admin/bookings', label: t('admin.bookings.title') }} title={booking.reference} description={booking.school.name} />
      <BookingDetail booking={booking} t={t} locale={locale} basePath="/admin/bookings" showCommission>
        {failedRefunds.length > 0 && (
          <Card title={t('admin.overview.failedRefunds')}>
            <ul className="space-y-2">
              {failedRefunds.map((refund) => (
                <li key={refund.id}>
                  <ActionButton action={retryRefundAction.bind(null, booking.id, refund.id)} successMessage={t('common.saved')}>
                    {t('admin.bookings.retryRefund')} ({centsToInput(refund.amountCents)} €)
                  </ActionButton>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {(booking.status === 'CONFIRMED' || booking.status === 'PENDING_PAYMENT') && (
          <Card title={t('admin.bookings.cancel')}>
            <ActionForm action={adminCancelBookingAction.bind(null, booking.id)} submitLabel={t('admin.bookings.cancel')} variant="danger" confirmMessage={t('common.areYouSure')} successMessage={t('admin.bookings.cancelled')}>
              <Field label={t('common.reason')}>
                <input name="reason" required className={inputClass} />
              </Field>
              <Field label={t('admin.bookings.refundAmount')} hint={`max. ${centsToInput(paid)} €`}>
                <input name="refund" inputMode="decimal" defaultValue={centsToInput(paid)} className={inputClass} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="notifyStudent" defaultChecked /> {t('admin.bookings.notifyStudent')}
              </label>
            </ActionForm>
          </Card>
        )}
      </BookingDetail>
    </div>
  )
}
