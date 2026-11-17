import Link from 'next/link'
import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { formatMoney } from '@/lib/money'
import { STALE_AFTER_DAYS } from '@/lib/config'
import { Card, PageHeader, Stat } from '@/components/app/ui'

export const metadata = {
  title: 'Overview | Admin',
}

function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export default async function AdminPage() {
  await requireAdmin()
  const { t, locale } = await getT()

  const now = new Date()
  const since = new Date(now.getTime() - 30 * 86_400_000)
  const staleBefore = new Date(now.getTime() - STALE_AFTER_DAYS * 86_400_000)

  const [
    byStatus,
    instantPartners,
    publishedCourses,
    openIntakes,
    confirmed30,
    commission30,
    searches30,
    checkouts30,
    failed30,
    cancelled30,
    pendingClaims,
    pendingApprovals,
    openDuplicates,
    openSupport,
    staleIntakes,
    failedRefunds,
    answered,
    legacyStudents,
    legacyRegistrations,
  ] = await Promise.all([
    prisma.school.groupBy({ by: ['status'], where: { mergedIntoId: null }, _count: { _all: true } }),
    prisma.school.count({ where: { status: 'PARTNER', instantBookingEnabled: true } }),
    prisma.courseType.count({ where: { publicationStatus: 'PUBLISHED' } }),
    prisma.intake.count({ where: { status: 'OPEN', archivedAt: null, startDate: { gte: now }, courseType: { publicationStatus: 'PUBLISHED' } } }),
    prisma.booking.count({ where: { status: 'CONFIRMED', confirmedAt: { gte: since } } }),
    prisma.booking.aggregate({ where: { status: 'CONFIRMED', channel: 'MARKETPLACE', confirmedAt: { gte: since } }, _sum: { commissionCents: true } }),
    prisma.analyticsEvent.count({ where: { type: 'search', createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { type: 'checkout_started', createdAt: { gte: since } } }),
    prisma.booking.count({ where: { status: 'FAILED_REFUNDED', updatedAt: { gte: since } } }),
    prisma.booking.count({ where: { status: 'CANCELLED', cancelledAt: { gte: since } } }),
    prisma.profileClaim.count({ where: { status: 'PENDING' } }),
    prisma.courseType.count({ where: { publicationStatus: 'PENDING_APPROVAL' } }),
    prisma.duplicateCandidate.count({ where: { status: 'OPEN' } }),
    prisma.supportRequest.count({ where: { status: { not: 'RESOLVED' } } }),
    prisma.intake.count({
      where: { status: 'OPEN', archivedAt: null, courseType: { publicationStatus: 'PUBLISHED' }, OR: [{ lastConfirmedAt: { lt: staleBefore } }, { startDate: { lt: now } }] },
    }),
    prisma.refund.count({ where: { status: { in: ['FAILED', 'PENDING'] } } }),
    prisma.enquiry.findMany({ where: { respondedAt: { not: null }, createdAt: { gte: since } }, select: { createdAt: true, respondedAt: true } }),
    prisma.student.count(),
    prisma.registration.count({ where: { status: 'NEW' } }),
  ])

  const count = (status: string) => byStatus.find((row) => row.status === status)?._count._all ?? 0
  const replyHours = median(answered.map((e) => (e.respondedAt!.getTime() - e.createdAt.getTime()) / 3_600_000))

  const todo = [
    { label: t('admin.overview.pendingClaims'), value: pendingClaims, href: '/admin/claims' },
    { label: t('admin.overview.pendingApprovals'), value: pendingApprovals, href: '/admin/approvals' },
    { label: t('admin.overview.openDuplicates'), value: openDuplicates, href: '/admin/duplicates' },
    { label: t('admin.overview.openSupport'), value: openSupport, href: '/admin/support' },
    { label: t('admin.overview.staleIntakes'), value: staleIntakes, href: '/admin/stale' },
    { label: t('admin.overview.failedRefunds'), value: failedRefunds, href: '/admin/bookings?status=FAILED_REFUNDED' },
  ]

  return (
    <div className="space-y-8">
      <PageHeader title={t('admin.overview.title')} description={t('admin.overview.subtitle')} />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        <Stat label={t('admin.overview.discovered')} value={count('DISCOVERED') + count('VERIFIED') + count('PARTNER')} href="/admin/cities" />
        <Stat label={t('admin.overview.verified')} value={count('VERIFIED')} href="/admin/schools?status=VERIFIED" />
        <Stat label={t('admin.overview.partners')} value={count('PARTNER')} href="/admin/schools?status=PARTNER" />
        <Stat label={t('admin.overview.instant')} value={instantPartners} />
        <Stat label={t('admin.overview.publishedCourses')} value={publishedCourses} />
        <Stat label={t('admin.overview.openIntakes')} value={openIntakes} href="/courses" />
        <Stat label={t('admin.overview.searches30')} value={searches30} />
        <Stat label={t('admin.overview.checkouts30')} value={checkouts30} />
        <Stat label={t('admin.overview.bookings30')} value={confirmed30} href="/admin/bookings" />
        <Stat label={t('admin.overview.failed30')} value={failed30} />
        <Stat label={t('admin.overview.cancellations30')} value={cancelled30} />
        <Stat label={t('admin.overview.revenue30')} value={formatMoney(commission30._sum.commissionCents ?? 0, 'EUR', locale)} href="/admin/bookings" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title={t('admin.overview.todo')}>
          <ul className="divide-y divide-border">
            {todo.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex items-center justify-between py-3 hover:text-primary">
                  <span className="text-sm">{item.label}</span>
                  <span className={`font-poppins font-bold ${item.value > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{item.value}</span>
                </Link>
              </li>
            ))}
            <li className="flex items-center justify-between py-3">
              <span className="text-sm">{t('admin.overview.responseTime')}</span>
              <span className="font-poppins font-bold">{replyHours === null ? '–' : t('admin.overview.hours', { count: replyHours.toFixed(1) })}</span>
            </li>
          </ul>
        </Card>

        <Card title={t('admin.nav.legacy')}>
          <ul className="divide-y divide-border text-sm">
            <li>
              <Link href="/admin/registrations?status=NEW" className="flex justify-between py-3 hover:text-primary">
                <span>{t('admin.nav.registrations')}</span>
                <span className="font-bold">{legacyRegistrations}</span>
              </Link>
            </li>
            <li>
              <Link href="/admin/students" className="flex justify-between py-3 hover:text-primary">
                <span>{t('admin.nav.students')}</span>
                <span className="font-bold">{legacyStudents}</span>
              </Link>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
