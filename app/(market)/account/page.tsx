import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { Card, EmptyState, StatusBadge, buttonClass } from '@/components/app/ui'

export const metadata = { title: 'My bookings' }

export default async function AccountPage() {
  const actor = await requireActor('/account')
  const { t, locale } = await getT()
  const now = new Date()
  const [bookings, legacy] = await Promise.all([
    prisma.booking.findMany({
      where: {
        studentUserId: actor.userId,
        OR: [{ status: { not: 'PENDING_PAYMENT' } }, { status: 'PENDING_PAYMENT', hold: { status: 'ACTIVE', expiresAt: { gt: now } } }],
        NOT: { status: 'EXPIRED' },
      },
      orderBy: { createdAt: 'desc' },
      include: { school: { select: { name: true } }, intake: { select: { startDate: true, startTime: true, courseType: { select: { name: true } } } } },
    }),
    prisma.student.findUnique({ where: { userId: actor.userId }, select: { _count: { select: { enrollments: true, certificates: true } } } }),
  ])

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="font-poppins text-3xl font-bold">{t('market.account.title')}</h1>
        <p className="text-muted-foreground">{t('market.account.subtitle')}</p>
      </div>
      {bookings.length === 0 ? (
        <Card>
          <EmptyState>{t('market.account.empty')}</EmptyState>
          <div className="text-center">
            <Link href="/courses" className={buttonClass}>
              {t('market.nav.findCourse')}
            </Link>
          </div>
        </Card>
      ) : (
        <ul className="space-y-4">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link
                href={b.status === 'PENDING_PAYMENT' ? `/checkout/${b.id}` : `/account/bookings/${b.id}`}
                className="block bg-white rounded-lg shadow-soft p-5 hover:shadow-premium transition-shadow"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-poppins font-bold text-lg">{b.intake.courseType.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.school.name} · {formatDay(b.intake.startDate, locale)} · {b.intake.startTime}
                    </p>
                    <p className="text-xs font-mono mt-1">{b.reference}</p>
                  </div>
                  <div className="text-end space-y-1">
                    <StatusBadge status={b.status} label={b.status === 'PENDING_PAYMENT' ? t('market.account.pending') : t(`enums.bookingStatus.${b.status}`)} />
                    <p className="font-semibold">{formatMoney(b.totalCents, b.currency, locale)}</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {legacy && (legacy._count.enrollments > 0 || legacy._count.certificates > 0) && (
        <Link href="/dashboard" className="text-sm text-primary underline">
          {t('market.account.legacyCourses')}
        </Link>
      )}
    </div>
  )
}
