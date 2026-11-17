import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireSchoolActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDateTime, formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { bookingWhere, filtersToQuery, readBookingFilters } from '@/lib/booking/filters'
import { paymentSummary } from '@/lib/booking/manage'
import { buttonClass, Card, inputClass, PageHeader, Pager, secondaryButtonClass, StatusBadge, Table, Td } from '@/components/app/ui'

export const metadata = { title: 'Bookings | School app' }

const PAGE_SIZE = 30

export default async function SchoolBookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireSchoolActor()
  const { t, locale } = await getT()
  const params = await searchParams
  // Never trust a school id from the URL: always the signed-in user's school.
  const filters = { ...readBookingFilters(params), schoolId: actor.schoolId, cityId: undefined }
  const page = Math.max(1, Number(params.page) || 1)
  const where = { AND: [bookingWhere(filters), { schoolId: actor.schoolId }, params.requests === '1' ? { cancellationRequestedAt: { not: null }, status: 'CONFIRMED' as const } : {}] }

  const [bookings, total, courseTypes, branches] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { payments: { include: { refunds: true } }, intake: { select: { startDate: true, courseType: { select: { name: true } } } } },
    }),
    prisma.booking.count({ where }),
    prisma.courseType.findMany({ where: { schoolId: actor.schoolId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.branch.findMany({ where: { schoolId: actor.schoolId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  const query = filtersToQuery({ ...filters, schoolId: undefined })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('school.bookings.title')}
        description={t('school.bookings.subtitle')}
        actions={
          <a href={`/api/school/bookings/export?${query}`} className={secondaryButtonClass}>
            {t('common.export')}
          </a>
        }
      />
      <form method="get" className="bg-white rounded-lg shadow-soft p-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <input name="search" defaultValue={filters.search} placeholder={`${t('admin.bookings.reference')}, ${t('common.name')}…`} className={`${inputClass} xl:col-span-2`} />
        <select name="course" defaultValue={filters.courseTypeId ?? ''} className={inputClass}>
          <option value="">{t('school.dashboard.allCourses')}</option>
          {courseTypes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="branch" defaultValue={filters.branchId ?? ''} className={inputClass}>
          <option value="">{t('school.dashboard.allBranches')}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status ?? ''} className={inputClass}>
          <option value="">{t('admin.schools.allStatuses')}</option>
          {(['CONFIRMED', 'PENDING_PAYMENT', 'CANCELLED', 'TRANSFERRED', 'FAILED_REFUNDED'] as const).map((s) => (
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
        <button className={buttonClass}>{t('common.filter')}</button>
      </form>
      <div className="flex gap-2 text-sm">
        <Link href="/school/bookings?requests=1" className="text-primary underline">
          {t('school.bookings.cancellationRequested')}
        </Link>
      </div>
      <Card>
        <Table
          head={[t('admin.bookings.reference'), t('admin.bookings.student'), t('admin.bookings.course'), t('admin.bookings.channel'), t('common.status'), t('common.total'), t('school.bookings.outstanding'), t('admin.bookings.created')]}
          empty={t('common.noResults')}
        >
          {bookings.map((b) => {
            const { outstanding } = paymentSummary(b)
            return (
              <tr key={b.id} className="hover:bg-cream">
                <Td>
                  <Link href={`/school/bookings/${b.id}`} className="font-mono font-medium hover:text-primary">
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
                <Td>{t(`enums.bookingChannel.${b.channel}`)}</Td>
                <Td>
                  <StatusBadge status={b.status} label={t(`enums.bookingStatus.${b.status}`)} />
                  {b.cancellationRequestedAt && b.status === 'CONFIRMED' && <p className="text-xs text-orange-700 mt-1">{t('school.bookings.cancellationRequested')}</p>}
                </Td>
                <Td className="whitespace-nowrap">{formatMoney(b.totalCents, b.currency, locale)}</Td>
                <Td className={outstanding > 0 ? 'text-red-700 font-semibold whitespace-nowrap' : 'whitespace-nowrap'}>{formatMoney(outstanding, b.currency, locale)}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(b.createdAt, locale)}</Td>
              </tr>
            )
          })}
        </Table>
        <Pager
          page={page}
          pageCount={pageCount}
          href={(p) => `/school/bookings?${new URLSearchParams({ ...Object.fromEntries(query), page: String(p) })}`}
          label={t('common.page', { page, pages: pageCount })}
        />
      </Card>
    </div>
  )
}
