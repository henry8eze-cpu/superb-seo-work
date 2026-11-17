import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDateTime, formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { paymentSummary } from '@/lib/booking/manage'
import { requestCancellationAction, supportRequestAction } from '@/app/actions/marketplace'
import { ActionForm } from '@/components/app/action-form'
import { Card, DefinitionList, Field, inputClass, StatusBadge } from '@/components/app/ui'

export const metadata = { title: 'Booking' }

export default async function AccountBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await requireActor(`/account/bookings/${id}`)
  const { t, locale } = await getT()
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      school: { select: { name: true, publicEmail: true, phone: true } },
      intake: { include: { fees: true, courseType: { include: { branch: true } } } },
      payments: { orderBy: { paidAt: 'asc' }, include: { refunds: true } },
      transferredTo: { select: { id: true, reference: true } },
    },
  })
  if (!booking || booking.studentUserId !== actor.userId) notFound()

  const { intake } = booking
  const branch = intake.courseType.branch
  const money = (cents: number) => formatMoney(cents, booking.currency, locale)
  const { paid, outstanding } = paymentSummary(booking)

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <Link href="/account" className="text-sm text-muted-foreground hover:text-primary">
        ← {t('market.account.title')}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-poppins text-2xl font-bold">{intake.courseType.name}</h1>
          <p className="text-muted-foreground">{booking.school.name}</p>
        </div>
        <StatusBadge status={booking.status} label={t(`enums.bookingStatus.${booking.status}`)} />
      </div>

      <Card>
        <DefinitionList
          items={[
            [t('admin.bookings.reference'), <span key="r" className="font-mono font-bold text-lg">{booking.reference}</span>],
            [t('market.course.dates'), `${formatDay(intake.startDate, locale)} – ${formatDay(intake.endDate, locale)}`],
            [t('market.course.schedule'), `${intake.weekdays.map((d) => t(`weekdays.short.${d}`)).join(', ')} · ${intake.startTime}–${intake.endTime}`],
            [t('market.course.location'), branch.isOnline ? t('market.course.online') : [branch.address, branch.postcode, branch.cityName].filter(Boolean).join(', ')],
            [t('market.course.school'), [booking.school.name, booking.school.publicEmail, booking.school.phone].filter(Boolean).join(' · ')],
            [t('market.course.totalPrice'), money(booking.totalCents)],
            [t('school.bookings.paid'), money(paid)],
            ...(outstanding > 0 ? ([[t('school.bookings.outstanding'), money(outstanding)]] as [string, string][]) : []),
            ...(booking.transferredTo
              ? ([[t('school.bookings.transferredTo'), <Link key="t" className="text-primary underline" href={`/account/bookings/${booking.transferredTo.id}`}>{booking.transferredTo.reference}</Link>]] as [string, React.ReactNode][])
              : []),
          ]}
        />
      </Card>

      <Card title={t('market.account.receipts')}>
        {booking.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{booking.paymentMethod ? t(`enums.paymentMethod.${booking.paymentMethod}`) : '–'}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {booking.payments.map((payment) => (
              <li key={payment.id} className="py-3">
                <div className="flex justify-between gap-3">
                  <span>
                    {t('market.account.receipt')} · {formatDateTime(payment.paidAt, locale)} · {t(`enums.paymentMethod.${payment.method}`)}
                    <span className="block text-xs text-muted-foreground font-mono">
                      {booking.reference}-{payment.id.slice(-6).toUpperCase()}
                    </span>
                  </span>
                  <span className="font-semibold">{money(payment.amountCents)}</span>
                </div>
                {payment.refunds.map((refund) => (
                  <p key={refund.id} className="text-xs text-orange-700 mt-1">
                    ↩ {money(refund.amountCents)} · {t(`enums.refundStatus.${refund.status}`)} · {formatDateTime(refund.createdAt, locale)}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t('market.course.cancellation')}>
        <p className="text-sm whitespace-pre-wrap text-muted-foreground mb-4">{intake.courseType.cancellationTerms}</p>
        {booking.status === 'CONFIRMED' &&
          (booking.cancellationRequestedAt ? (
            <p className="text-sm font-medium text-orange-700">{t('market.account.requestedOn', { date: formatDateTime(booking.cancellationRequestedAt, locale) })}</p>
          ) : (
            <ActionForm
              action={requestCancellationAction.bind(null, booking.id)}
              submitLabel={t('market.account.requestCancel')}
              variant="danger"
              confirmMessage={t('common.areYouSure')}
              successMessage={t('market.account.requestSent')}
            >
              <p className="text-xs text-muted-foreground">{t('market.account.requestCancelHint')}</p>
              <textarea name="message" rows={2} placeholder={t('common.reason')} className={inputClass} />
            </ActionForm>
          ))}
      </Card>

      <Card title={t('market.account.help')}>
        <ActionForm action={supportRequestAction} submitLabel={t('market.account.helpSend')} successMessage={t('market.account.helpSent')} resetOnSuccess variant="secondary">
          <input type="hidden" name="bookingId" value={booking.id} />
          <input type="hidden" name="type" value="BOOKING_PROBLEM" />
          <Field label={t('market.account.helpSubject')}>
            <input name="subject" required defaultValue={booking.reference} className={inputClass} />
          </Field>
          <Field label={t('common.message')}>
            <textarea name="message" rows={3} required minLength={10} className={inputClass} />
          </Field>
        </ActionForm>
      </Card>
    </div>
  )
}
