import Link from 'next/link'
import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { formatDateTime, formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { bookingWhere, filtersToQuery, readBookingFilters } from '@/lib/booking/filters'
import { buttonClass, Card, inputClass, PageHeader, Pager, secondaryButtonClass, Stat, StatusBadge, Table, Td } from '@/components/app/ui'

export const metadata = { title: 'Bookings | Admin' }

const PAGE_SIZE = 30

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const { t, locale } = await getT()
  const params = await searchParams
  const filters = readBookingFilters(params)
  const page = Math.max(1, Number(params.page) || 1)
  const where = bookingWhere(filters)
  const confirmedWhere = { AND: [where, { status: 'CONFIRMED' as const }] }

  const [bookings, total, schools, cities, totals, marketplaceTotals, bySchool, confirmedWithCity, subscriptions] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { school: { select: { name: true } }, intake: { select: { startDate: true, courseType: { select: { name: true } } } } },
    }),
    prisma.booking.count({ where }),
    prisma.school.findMany({ where: { bookings: { some: {} } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.city.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
    prisma.booking.aggregate({ where: confirmedWhere, _sum: { totalCents: true, commissionCents: true }, _count: { _all: true } }),
    prisma.booking.aggregate({ where: { AND: [confirmedWhere, { channel: 'MARKETPLACE' }] }, _sum: { totalCents: true }, _count: { _all: true } }),
    prisma.booking.groupBy({ by: ['schoolId'], where: confirmedWhere, _sum: { totalCents: true, commissionCents: true }, _count: { _all: true } }),
    prisma.booking.findMany({
      where: confirmedWhere,
      select: { totalCents: true, commissionCents: true, intake: { select: { courseType: { select: { branch: { select: { city: { select: { name: true } }, isOnline: true } } } } } } },
    }),
    prisma.subscription.aggregate({ where: { status: { in: ['ACTIVE', 'PAST_DUE'] } }, _sum: { monthlyPriceCents: true } }),
  ])

  const byCity = new Map<string, { count: number; total: number; commission: number }>()
  for (const b of confirmedWithCity) {
    const branch = b.intake.courseType.branch
    const key = branch.isOnline ? t('common.online') : branch.city?.name ?? '–'
    const row = byCity.get(key) ?? { count: 0, total: 0, commission: 0 }
    row.count++
    row.total += b.totalCents
    row.commission += b.commissionCents
    byCity.set(key, row)
  }
  const schoolNames = new Map((await prisma.school.findMany({ where: { id: { in: bySchool.map((r) => r.schoolId) } }, select: { id: true, name: true } })).map((s) => [s.id, s.name]))

  const gross = totals._sum.totalCents ?? 0
  const commission = totals._sum.commissionCents ?? 0
  const query = filtersToQuery(filters)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const money = (cents: number) => formatMoney(cents, 'EUR', locale)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.bookings.title')}
        description={t('admin.bookings.subtitle')}
        actions={
          <a href={`/api/admin/bookings/export?${query}`} className={secondaryButtonClass}>
            {t('common.export')}
          </a>
        }
      />

      <form method="get" className="bg-white rounded-lg shadow-soft p-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <input name="search" defaultValue={filters.search} placeholder={`${t('admin.bookings.reference')}, ${t('common.name')}…`} className={`${inputClass} xl:col-span-2`} />
        <select name="school" defaultValue={filters.schoolId ?? ''} className={inputClass}>
          <option value="">{t('admin.bookings.allSchools')}</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="city" defaultValue={filters.cityId ?? ''} className={inputClass}>
          <option value="">{t('admin.schools.allCities')}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status ?? ''} className={inputClass}>
          <option value="">{t('admin.schools.allStatuses')}</option>
          {(['CONFIRMED', 'PENDING_PAYMENT', 'CANCELLED', 'TRANSFERRED', 'FAILED_REFUNDED', 'EXPIRED'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`enums.bookingStatus.${s}`)}
            </option>
          ))}
        </select>
        <select name="channel" defaultValue={filters.channel ?? ''} className={inputClass}>
          <option value="">{t('admin.bookings.allChannels')}</option>
          <option value="MARKETPLACE">{t('enums.bookingChannel.MARKETPLACE')}</option>
          <option value="DIRECT">{t('enums.bookingChannel.DIRECT')}</option>
        </select>
        <input type="date" name="from" defaultValue={filters.from} className={inputClass} aria-label={t('common.from')} />
        <input type="date" name="to" defaultValue={filters.to} className={inputClass} aria-label={t('common.to')} />
        <button className={`${buttonClass} md:col-span-4 xl:col-span-8 justify-self-start`}>{t('common.filter')}</button>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label={t('admin.bookings.count')} value={totals._count._all} hint={`${t('enums.bookingChannel.MARKETPLACE')}: ${marketplaceTotals._count._all}`} />
        <Stat label={t('admin.bookings.gross')} value={money(gross)} />
        <Stat label={t('admin.bookings.toSchools')} value={money(gross - commission)} />
        <Stat label={t('admin.bookings.commission')} value={money(commission)} />
        <Stat label={t('admin.bookings.subscriptions')} value={money(subscriptions._sum.monthlyPriceCents ?? 0)} />
      </div>
      <p className="text-xs text-muted-foreground -mt-3">{t('admin.bookings.confirmedOnly')}</p>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title={t('admin.bookings.bySchool')}>
          <Table head={[t('admin.bookings.school'), t('admin.bookings.count'), t('admin.bookings.gross'), t('admin.bookings.commission')]} empty={t('common.noResults')}>
            {bySchool
              .sort((a, b) => (b._sum.totalCents ?? 0) - (a._sum.totalCents ?? 0))
              .map((row) => (
                <tr key={row.schoolId}>
                  <Td>
                    <Link href={`/admin/bookings?${new URLSearchParams({ ...Object.fromEntries(query), school: row.schoolId })}`} className="hover:text-primary">
                      {schoolNames.get(row.schoolId)}
                    </Link>
                  </Td>
                  <Td>{row._count._all}</Td>
                  <Td>{money(row._sum.totalCents ?? 0)}</Td>
                  <Td>{money(row._sum.commissionCents ?? 0)}</Td>
                </tr>
              ))}
          </Table>
        </Card>
        <Card title={t('admin.bookings.byCity')}>
          <Table head={[t('common.city'), t('admin.bookings.count'), t('admin.bookings.gross'), t('admin.bookings.commission')]} empty={t('common.noResults')}>
            {[...byCity.entries()]
              .sort((a, b) => b[1].total - a[1].total)
              .map(([city, row]) => (
                <tr key={city}>
                  <Td>{city}</Td>
                  <Td>{row.count}</Td>
                  <Td>{money(row.total)}</Td>
                  <Td>{money(row.commission)}</Td>
                </tr>
              ))}
          </Table>
        </Card>
      </div>

      <Card>
        <p className="text-sm text-muted-foreground mb-3">{t('common.showing', { count: total })}</p>
        <Table
          head={[t('admin.bookings.reference'), t('admin.bookings.student'), t('admin.bookings.course'), t('admin.bookings.school'), t('admin.bookings.channel'), t('common.status'), t('common.total'), t('admin.bookings.created')]}
          empty={t('common.noResults')}
        >
          {bookings.map((b) => (
            <tr key={b.id} className="hover:bg-cream">
              <Td>
                <Link href={`/admin/bookings/${b.id}`} className="font-mono font-medium hover:text-primary">
                  {b.reference}
                </Link>
              </Td>
              <Td>
                {b.studentName}
                <p className="text-xs text-muted-foreground">{b.studentEmail}</p>
              </Td>
              <Td>
                {b.intake.courseType.name}
                <p className="text-xs text-muted-foreground">{formatDay(b.intake.startDate, locale)}</p>
              </Td>
              <Td>{b.school.name}</Td>
              <Td>{t(`enums.bookingChannel.${b.channel}`)}</Td>
              <Td>
                <StatusBadge status={b.status} label={t(`enums.bookingStatus.${b.status}`)} />
              </Td>
              <Td className="whitespace-nowrap">{money(b.totalCents)}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(b.createdAt, locale)}</Td>
            </tr>
          ))}
        </Table>
        <Pager
          page={page}
          pageCount={pageCount}
          href={(p) => `/admin/bookings?${new URLSearchParams({ ...Object.fromEntries(query), page: String(p) })}`}
          label={t('common.page', { page, pages: pageCount })}
        />
      </Card>
    </div>
  )
}
