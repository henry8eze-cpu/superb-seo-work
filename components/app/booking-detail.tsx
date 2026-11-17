import Link from 'next/link'
import type { ReactNode } from 'react'
import { prisma } from '@/lib/prisma'
import type { Translate } from '@/lib/i18n'
import { formatDateTime, formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { paymentSummary } from '@/lib/booking/manage'
import { AuditList } from './audit-list'
import { Badge, Card, DefinitionList, StatusBadge } from './ui'

export async function loadBookingDetail(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      school: { select: { id: true, name: true } },
      intake: { include: { fees: true, courseType: { include: { branch: true } } } },
      payments: { orderBy: { paidAt: 'asc' }, include: { refunds: true, recordedBy: { select: { name: true } } } },
      refunds: { orderBy: { createdAt: 'asc' } },
      hold: true,
      transferredFrom: { select: { id: true, reference: true } },
      transferredTo: { select: { id: true, reference: true } },
      createdBy: { select: { name: true } },
      commissionTerms: true,
    },
  })
}

export type BookingDetailData = NonNullable<Awaited<ReturnType<typeof loadBookingDetail>>>

/** Everything about one booking. `basePath` is where sibling bookings link to (admin or school). */
export async function BookingDetail({
  booking,
  t,
  locale,
  basePath,
  showCommission,
  children,
}: {
  booking: BookingDetailData
  t: Translate
  locale: string
  basePath: string
  showCommission: boolean
  children?: ReactNode
}) {
  const history = await prisma.auditEvent.findMany({
    where: { OR: [{ entityId: booking.id }, { entity: 'Payment', entityId: { in: booking.payments.map((p) => p.id) } }] },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { actor: { select: { name: true } } },
  })
  const { paid, outstanding } = paymentSummary(booking)
  const money = (cents: number) => formatMoney(cents, booking.currency, locale)
  const { intake } = booking
  const branch = intake.courseType.branch

  return (
    <div className="grid xl:grid-cols-3 gap-6 items-start">
      <div className="xl:col-span-2 space-y-6">
        <Card title={t('admin.bookings.reference') + ' ' + booking.reference} actions={<StatusBadge status={booking.status} label={t(`enums.bookingStatus.${booking.status}`)} />}>
          <DefinitionList
            items={[
              [t('admin.bookings.student'), `${booking.studentName} · ${booking.studentEmail}${booking.studentPhone ? ` · ${booking.studentPhone}` : ''}`],
              [t('admin.bookings.course'), intake.courseType.name],
              [t('admin.bookings.school'), booking.school.name],
              [t('emails.bookingConfirmed.location'), branch.isOnline ? t('common.online') : [branch.address, branch.postcode, branch.cityName].filter(Boolean).join(', ')],
              [t('emails.bookingConfirmed.dates'), `${formatDay(intake.startDate, locale)} – ${formatDay(intake.endDate, locale)}`],
              [t('emails.bookingConfirmed.schedule'), `${intake.weekdays.map((d) => t(`weekdays.short.${d}`)).join(', ')} · ${intake.startTime}–${intake.endTime}`],
              [t('admin.bookings.channel'), t(`enums.bookingChannel.${booking.channel}`)],
              [t('school.bookings.paymentMethod'), booking.paymentMethod ? t(`enums.paymentMethod.${booking.paymentMethod}`) : '–'],
              [t('admin.bookings.created'), `${formatDateTime(booking.createdAt, locale)}${booking.createdBy ? ` · ${booking.createdBy.name}` : ''}`],
              [t('enums.bookingStatus.CONFIRMED'), formatDateTime(booking.confirmedAt, locale)],
              ...(booking.cancelledAt ? ([[t('enums.bookingStatus.CANCELLED'), `${formatDateTime(booking.cancelledAt, locale)} · ${booking.cancelReason ?? ''}`]] as [string, ReactNode][]) : []),
              ...(booking.cancellationRequestedAt
                ? ([[t('school.bookings.cancellationRequested'), <Badge key="c" tone="orange">{formatDateTime(booking.cancellationRequestedAt, locale)}</Badge>]] as [string, ReactNode][])
                : []),
              ...(booking.transferredFrom
                ? ([[t('school.bookings.transferredFrom'), <Link key="f" className="text-primary underline" href={`${basePath}/${booking.transferredFrom.id}`}>{booking.transferredFrom.reference}</Link>]] as [string, ReactNode][])
                : []),
              ...(booking.transferredTo
                ? ([[t('school.bookings.transferredTo'), <Link key="t" className="text-primary underline" href={`${basePath}/${booking.transferredTo.id}`}>{booking.transferredTo.reference}</Link>]] as [string, ReactNode][])
                : []),
              ...(booking.notes ? ([[t('common.notes'), <span key="n" className="whitespace-pre-wrap">{booking.notes}</span>]] as [string, ReactNode][]) : []),
            ]}
          />
        </Card>

        <Card title={t('admin.bookings.paymentsRefunds')}>
          <DefinitionList
            items={[
              [t('school.bookings.coursePrice'), money(booking.priceCents)],
              ...(intake.fees.length && booking.feesCents
                ? intake.fees.filter((f) => f.compulsory).map((f) => [f.label, money(f.amountCents)] as [string, ReactNode])
                : []),
              [t('common.total'), <strong key="t">{money(booking.totalCents)}</strong>],
              [t('school.bookings.paid'), money(paid)],
              [t('school.bookings.outstanding'), <span key="o" className={outstanding > 0 ? 'text-red-700 font-semibold' : ''}>{money(outstanding)}</span>],
              ...(showCommission && booking.channel === 'MARKETPLACE'
                ? ([[t('admin.bookings.commission'), money(booking.commissionCents)]] as [string, ReactNode][])
                : []),
            ]}
          />
          {booking.payments.length > 0 && (
            <ul className="mt-4 divide-y divide-border text-sm">
              {booking.payments.map((payment) => (
                <li key={payment.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{money(payment.amountCents)}</strong>
                    <span>{t(`enums.paymentMethod.${payment.method}`)}</span>
                    <StatusBadge status={payment.status} label={t(`enums.paymentStatus.${payment.status}`)} />
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(payment.paidAt, locale)} {payment.recordedBy && `· ${payment.recordedBy.name}`} {payment.note && `· ${payment.note}`}
                    </span>
                  </div>
                  {payment.refunds.map((refund) => (
                    <p key={refund.id} className="text-xs ms-4 mt-1">
                      ↩ {money(refund.amountCents)} · <StatusBadge status={refund.status} label={t(`enums.refundStatus.${refund.status}`)} /> {refund.reason && `· ${refund.reason}`}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('admin.school.history')}>
          <AuditList events={history} t={t} locale={locale} />
        </Card>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  )
}
