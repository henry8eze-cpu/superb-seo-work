import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDay, formatTime } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { payAtSchoolAction, payByCardAction, releaseHoldAction } from '@/app/actions/marketplace'
import { ActionButton } from '@/components/app/action-form'
import { buttonClass, Card } from '@/components/app/ui'
import { HoldCountdown } from '@/components/market/checkout-client'

export const metadata = { title: 'Checkout' }

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const { id } = await params
  const { cancelled } = await searchParams
  const actor = await requireActor(`/checkout/${id}`)
  const { t, locale } = await getT()
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { hold: true, school: true, intake: { include: { fees: true, courseType: { include: { branch: true } } } } },
  })
  if (!booking || booking.studentUserId !== actor.userId) notFound()
  if (booking.status === 'CONFIRMED' || booking.status === 'FAILED_REFUNDED') redirect(`/checkout/${id}/success`)

  const now = new Date()
  const live = booking.status === 'PENDING_PAYMENT' && booking.hold?.status === 'ACTIVE' && booking.hold.expiresAt > now
  const { intake } = booking
  const money = (cents: number) => formatMoney(cents, booking.currency, locale)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="font-poppins text-3xl font-bold">{t('market.checkout.title')}</h1>

      <Card>
        <p className="font-poppins font-bold text-lg">{intake.courseType.name}</p>
        <p className="text-sm text-muted-foreground">{booking.school.name}</p>
        <p className="text-sm mt-2">
          {formatDay(intake.startDate, locale)} – {formatDay(intake.endDate, locale)} · {intake.weekdays.map((d) => t(`weekdays.short.${d}`)).join(', ')} {intake.startTime}–{intake.endTime}
        </p>
        <dl className="text-sm mt-4 space-y-1">
          <div className="flex justify-between">
            <dt>{t('market.course.coursePrice')}</dt>
            <dd>{money(booking.priceCents)}</dd>
          </div>
          {intake.fees
            .filter((f) => f.compulsory)
            .map((fee) => (
              <div key={fee.id} className="flex justify-between">
                <dt>{fee.label}</dt>
                <dd>{money(fee.amountCents)}</dd>
              </div>
            ))}
          <div className="flex justify-between font-bold text-base border-t border-border pt-2">
            <dt>{t('market.course.totalPrice')}</dt>
            <dd>{money(booking.totalCents)}</dd>
          </div>
        </dl>
        <details className="text-sm mt-4">
          <summary className="cursor-pointer font-medium">{t('market.course.cancellation')}</summary>
          <p className="whitespace-pre-wrap mt-2 text-muted-foreground">{intake.courseType.cancellationTerms}</p>
        </details>
      </Card>

      {live ? (
        <Card>
          <p className="text-sm mb-4">
            {t('market.checkout.heldUntil', { time: formatTime(booking.hold!.expiresAt, locale) })}{' '}
            (<HoldCountdown expiresAt={booking.hold!.expiresAt.toISOString()} />)
          </p>
          {cancelled && <p className="text-sm bg-yellow-50 text-yellow-900 rounded-lg px-3 py-2 mb-4">{t('market.checkout.cancelled')}</p>}
          <div className="space-y-3">
            <ActionButton action={payByCardAction.bind(null, booking.id)} variant="primary" className="w-full py-3 text-base">
              {t('market.checkout.payCard', { amount: money(booking.totalCents) })}
            </ActionButton>
            {booking.school.allowPayAtSchool && (
              <>
                <ActionButton action={payAtSchoolAction.bind(null, booking.id)} className="w-full py-3">
                  {t('market.checkout.payAtSchool')}
                </ActionButton>
                <p className="text-xs text-muted-foreground">{t('market.checkout.payAtSchoolHint')}</p>
              </>
            )}
            <p className="text-xs text-muted-foreground">{t('market.checkout.terms')}</p>
            <ActionButton action={releaseHoldAction.bind(null, booking.id)} className="w-full border-none text-muted-foreground">
              {t('market.checkout.release')}
            </ActionButton>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="font-medium mb-4">{t('market.checkout.expired')}</p>
          <Link href={`/courses/${booking.intakeId}`} className={buttonClass}>
            {t('market.checkout.startAgain')}
          </Link>
        </Card>
      )}
    </div>
  )
}
