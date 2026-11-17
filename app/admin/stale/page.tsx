import Link from 'next/link'
import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { daysBetween, formatDate, formatDay } from '@/lib/dates'
import { STALE_AFTER_DAYS } from '@/lib/config'
import { Card, PageHeader, Table, Td } from '@/components/app/ui'

export const metadata = { title: 'Outdated data | Admin' }

const SCHOOL_CHECK_DAYS = 180

export default async function StalePage() {
  await requireAdmin()
  const { t, locale } = await getT()
  const now = new Date()
  const staleBefore = new Date(now.getTime() - STALE_AFTER_DAYS * 86_400_000)
  const schoolBefore = new Date(now.getTime() - SCHOOL_CHECK_DAYS * 86_400_000)
  const include = { school: { select: { id: true, name: true } }, courseType: { select: { name: true } } } as const

  const [notConfirmed, startedOpen, schools] = await Promise.all([
    prisma.intake.findMany({
      where: { status: 'OPEN', archivedAt: null, startDate: { gte: now }, lastConfirmedAt: { lt: staleBefore }, courseType: { publicationStatus: 'PUBLISHED' } },
      orderBy: { lastConfirmedAt: 'asc' },
      take: 200,
      include,
    }),
    prisma.intake.findMany({
      where: { status: 'OPEN', archivedAt: null, startDate: { lt: now }, courseType: { publicationStatus: 'PUBLISHED' } },
      orderBy: { startDate: 'asc' },
      take: 200,
      include,
    }),
    prisma.school.findMany({
      where: { status: { in: ['VERIFIED', 'PARTNER'] }, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: schoolBefore } }] },
      orderBy: { lastCheckedAt: 'asc' },
      take: 200,
      select: { id: true, name: true, lastCheckedAt: true, status: true },
    }),
  ])

  const intakeRows = (rows: typeof notConfirmed, showConfirmed: boolean) =>
    rows.map((intake) => (
      <tr key={intake.id} className="hover:bg-cream">
        <Td>
          <Link href={`/admin/schools/${intake.school.id}`} className="hover:text-primary">
            {intake.school.name}
          </Link>
        </Td>
        <Td>{intake.courseType.name}</Td>
        <Td className="whitespace-nowrap">{formatDay(intake.startDate, locale)}</Td>
        <Td className="text-muted-foreground whitespace-nowrap">
          {showConfirmed ? t('admin.stale.confirmedAgo', { days: daysBetween(intake.lastConfirmedAt, now) }) : formatDate(intake.lastConfirmedAt, locale)}
        </Td>
      </tr>
    ))

  const head = [t('admin.bookings.school'), t('admin.bookings.course'), t('common.from'), t('common.lastConfirmedShort')]

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.stale.title')} description={t('admin.stale.subtitle', { days: STALE_AFTER_DAYS })} />
      <Card title={`${t('admin.stale.notConfirmed')} (${notConfirmed.length})`}>
        <Table head={head} empty={t('common.noResults')}>
          {intakeRows(notConfirmed, true)}
        </Table>
      </Card>
      <Card title={`${t('admin.stale.startedStillOpen')} (${startedOpen.length})`}>
        <Table head={head} empty={t('common.noResults')}>
          {intakeRows(startedOpen, false)}
        </Table>
      </Card>
      <Card title={`${t('admin.stale.schoolsUnchecked', { days: SCHOOL_CHECK_DAYS })} (${schools.length})`}>
        <ul className="text-sm divide-y divide-border">
          {schools.map((school) => (
            <li key={school.id} className="py-2 flex justify-between">
              <Link href={`/admin/schools/${school.id}`} className="hover:text-primary">
                {school.name}
              </Link>
              <span className="text-muted-foreground">{school.lastCheckedAt ? formatDate(school.lastCheckedAt, locale) : t('admin.schools.never')}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
