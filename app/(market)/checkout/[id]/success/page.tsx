import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDay } from '@/lib/dates'
import { buttonClass, Card } from '@/components/app/ui'
import { AutoRefresh } from '@/components/market/checkout-client'

export const metadata = { title: 'Booking' }

export default async function CheckoutResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await requireActor(`/checkout/${id}/success`)
  const { t, locale } = await getT()
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { school: { select: { name: true } }, intake: { select: { id: true, startDate: true, courseType: { select: { name: true } } } } },
  })
  if (!booking || booking.studentUserId !== actor.userId) notFound()

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <Card className="text-center space-y-4 py-10">
        {booking.status === 'CONFIRMED' ? (
          <>
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
            <h1 className="font-poppins text-2xl font-bold">{t('market.checkout.confirmedTitle')}</h1>
            <p className="font-mono text-2xl font-bold tracking-wider text-primary">{booking.reference}</p>
            <p className="text-sm text-muted-foreground">{t('market.checkout.confirmedBody', { reference: booking.reference, email: booking.studentEmail })}</p>
            <p className="text-sm">
              {booking.intake.courseType.name} · {booking.school.name} · {formatDay(booking.intake.startDate, locale)}
            </p>
            <Link href={`/account/bookings/${booking.id}`} className={buttonClass}>
              {t('market.course.viewBooking')}
            </Link>
          </>
        ) : booking.status === 'FAILED_REFUNDED' ? (
          <>
            <RotateCcw className="w-14 h-14 text-orange-600 mx-auto" />
            <h1 className="font-poppins text-2xl font-bold">{t('market.checkout.refundedTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('market.checkout.refundedBody')}</p>
            <Link href={`/courses/${booking.intake.id}`} className={buttonClass}>
              {t('market.course.otherDates')}
            </Link>
          </>
        ) : booking.status === 'PENDING_PAYMENT' ? (
          <>
            <AutoRefresh />
            <Loader2 className="w-14 h-14 text-primary mx-auto animate-spin" />
            <h1 className="font-poppins text-2xl font-bold">{t('market.checkout.confirmingTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('market.checkout.confirmingBody')}</p>
          </>
        ) : (
          <>
            <h1 className="font-poppins text-2xl font-bold">{t(`enums.bookingStatus.${booking.status}`)}</h1>
            <Link href={`/courses/${booking.intake.id}`} className={buttonClass}>
              {t('market.checkout.startAgain')}
            </Link>
          </>
        )}
      </Card>
    </div>
  )
}
