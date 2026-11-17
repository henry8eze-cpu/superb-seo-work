import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSchoolActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDay, toDayInput } from '@/lib/dates'
import { centsToInput } from '@/lib/money'
import { paymentSummary } from '@/lib/booking/manage'
import { cancelBookingAction, recordPaymentAction, transferBookingAction } from '@/app/actions/school'
import { ActionForm } from '@/components/app/action-form'
import { BookingDetail, loadBookingDetail } from '@/components/app/booking-detail'
import { Card, Field, inputClass, PageHeader } from '@/components/app/ui'

export const metadata = { title: 'Booking | School app' }

export default async function SchoolBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSchoolActor()
  const { id } = await params
  const { t, locale } = await getT()
  const booking = await loadBookingDetail(id)
  if (!booking || booking.schoolId !== actor.schoolId) notFound()

  const { paid, outstanding } = paymentSummary(booking)
  const canManage = actor.permissions.manageBookings && booking.status === 'CONFIRMED'
  const otherIntakes = canManage
    ? await prisma.intake.findMany({
        where: { schoolId: actor.schoolId, id: { not: booking.intakeId }, archivedAt: null, status: { not: 'CLOSED' }, endDate: { gte: new Date() } },
        orderBy: { startDate: 'asc' },
        include: { courseType: { select: { name: true } } },
      })
    : []

  return (
    <div>
      <PageHeader back={{ href: '/school/bookings', label: t('school.bookings.title') }} title={booking.reference} description={booking.studentName} />
      <BookingDetail booking={booking} t={t} locale={locale} basePath="/school/bookings" showCommission={actor.permissions.viewFinances}>
        {canManage && (
          <>
            <Card title={t('school.bookings.recordPayment')}>
              <ActionForm action={recordPaymentAction.bind(null, booking.id)} submitLabel={t('school.bookings.recordPayment')} successMessage={t('school.bookings.paymentRecorded')} resetOnSuccess>
                <Field label={t('school.bookings.amount')}>
                  <input name="amount" inputMode="decimal" required defaultValue={outstanding > 0 ? centsToInput(outstanding) : ''} className={inputClass} />
                </Field>
                <Field label={t('school.bookings.paymentMethod')}>
                  <select name="method" className={inputClass}>
                    {(['BANK_TRANSFER', 'CASH', 'CARD', 'OTHER'] as const).map((m) => (
                      <option key={m} value={m}>
                        {t(`enums.paymentMethod.${m}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('school.bookings.paidAt')}>
                  <input name="paidAt" type="date" defaultValue={toDayInput(new Date())} className={inputClass} />
                </Field>
                <input name="note" placeholder={t('common.notes')} className={inputClass} />
              </ActionForm>
            </Card>

            <Card title={t('school.bookings.transfer')}>
              {otherIntakes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('school.bookings.noOtherIntakes')}</p>
              ) : (
                <ActionForm
                  action={transferBookingAction.bind(null, booking.id)}
                  submitLabel={t('school.bookings.transfer')}
                  successMessage={t('school.bookings.transferred')}
                  redirectTo="/school/bookings/:id"
                  confirmMessage={t('common.areYouSure')}
                >
                  <Field label={t('school.bookings.transferTo')}>
                    <select name="toIntakeId" required className={inputClass}>
                      {otherIntakes.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.courseType.name} · {formatDay(i.startDate, locale)} · {i.startTime}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('common.reason')}>
                    <input name="reason" required className={inputClass} />
                  </Field>
                </ActionForm>
              )}
            </Card>

            <Card title={t('school.bookings.cancel')}>
              <ActionForm action={cancelBookingAction.bind(null, booking.id)} submitLabel={t('school.bookings.cancel')} variant="danger" confirmMessage={t('common.areYouSure')} successMessage={t('school.bookings.cancelled')}>
                <Field label={t('common.reason')}>
                  <input name="reason" required className={inputClass} />
                </Field>
                <Field label={t('school.bookings.refund')} hint={t('school.bookings.refundHint')}>
                  <input name="refund" inputMode="decimal" defaultValue={centsToInput(paid)} className={inputClass} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notifyStudent" defaultChecked /> {t('admin.bookings.notifyStudent')}
                </label>
              </ActionForm>
            </Card>
          </>
        )}
      </BookingDetail>
    </div>
  )
}
