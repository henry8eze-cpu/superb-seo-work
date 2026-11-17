import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireSchoolActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDate, formatDay, toDayInput } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { activeTerms } from '@/lib/booking/rules'
import { buttonClass, Card, DefinitionList, inputClass, PageHeader, Stat, StatusBadge, Table, Td } from '@/components/app/ui'

export const metadata = { title: 'Finance | School app' }

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await requireSchoolActor()
  const { t, locale } = await getT()
  if (!actor.permissions.viewFinances) {
    return <p className="text-sm">{t('school.noPermission')}</p>
  }
  const params = await searchParams
  const now = new Date()
  const from = params.from ? new Date(`${params.from}T00:00:00Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const to = params.to ? new Date(new Date(`${params.to}T00:00:00Z`).getTime() + 86_400_000) : new Date(now.getTime() + 86_400_000)
  const money = (cents: number) => formatMoney(cents, 'EUR', locale)

  const [terms, subscription, bookings] = await Promise.all([
    prisma.commissionTerms.findMany({ where: { schoolId: actor.schoolId }, orderBy: { validFrom: 'desc' } }),
    prisma.subscription.findFirst({ where: { schoolId: actor.schoolId }, orderBy: { createdAt: 'desc' } }),
    prisma.booking.findMany({
      where: { schoolId: actor.schoolId, channel: 'MARKETPLACE', status: 'CONFIRMED', confirmedAt: { gte: from, lt: to } },
      orderBy: { confirmedAt: 'desc' },
      include: { intake: { select: { startDate: true, courseType: { select: { name: true } } } } },
    }),
  ])
  const current = activeTerms(terms)
  const value = bookings.reduce((s, b) => s + b.totalCents, 0)
  const commission = bookings.reduce((s, b) => s + b.commissionCents, 0)

  return (
    <div className="space-y-6">
      <PageHeader title={t('school.finance.title')} description={t('school.finance.subtitle')} />
      <div className="grid md:grid-cols-2 gap-6">
        <Card title={t('school.finance.terms')}>
          <p className="text-lg font-semibold">
            {current
              ? current.type === 'FIXED'
                ? `${money(current.fixedCents ?? 0)} · ${t('enums.commissionType.FIXED')}`
                : `${((current.percentBps ?? 0) / 100).toFixed(2)} % · ${t('enums.commissionType.PERCENT')}`
              : t('admin.school.noCommission')}
          </p>
          {current && <p className="text-xs text-muted-foreground mt-1">{t('admin.school.validFrom')} {formatDate(current.validFrom, locale)}</p>}
        </Card>
        <Card title={t('school.finance.subscription')}>
          {subscription && subscription.status !== 'NONE' ? (
            <DefinitionList
              items={[
                [t('common.status'), <StatusBadge key="s" status={subscription.status} label={t(`enums.subscriptionStatus.${subscription.status}`)} />],
                [t('admin.school.monthlyPrice'), t('school.finance.perMonth', { price: money(subscription.monthlyPriceCents) })],
                [t('admin.school.startedAt'), formatDate(subscription.startedAt, locale)],
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('school.finance.noSubscription')}</p>
          )}
        </Card>
      </div>

      <form method="get" className="bg-white rounded-lg shadow-soft p-4 flex flex-wrap gap-3 items-end">
        <input type="date" name="from" defaultValue={params.from ?? toDayInput(from)} className={`${inputClass} w-auto`} aria-label={t('common.from')} />
        <input type="date" name="to" defaultValue={params.to ?? ''} className={`${inputClass} w-auto`} aria-label={t('common.to')} />
        <button className={buttonClass}>{t('common.filter')}</button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label={t('school.finance.marketplaceValue')} value={money(value)} />
        <Stat label={t('school.finance.commissionTotal')} value={money(commission)} />
        <Stat label={t('school.finance.payout')} value={money(value - commission)} />
      </div>

      <Card title={t('school.finance.bookingsWithCommission')}>
        <Table head={[t('admin.bookings.reference'), t('admin.bookings.course'), t('enums.bookingStatus.CONFIRMED'), t('common.total'), t('admin.bookings.commission')]} empty={t('common.noResults')}>
          {bookings.map((b) => (
            <tr key={b.id}>
              <Td>
                <Link href={`/school/bookings/${b.id}`} className="font-mono hover:text-primary">
                  {b.reference}
                </Link>
              </Td>
              <Td>
                {b.intake.courseType.name} <span className="text-xs text-muted-foreground">· {formatDay(b.intake.startDate, locale)}</span>
              </Td>
              <Td className="whitespace-nowrap">{formatDate(b.confirmedAt, locale)}</Td>
              <Td>{money(b.totalCents)}</Td>
              <Td>{money(b.commissionCents)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
