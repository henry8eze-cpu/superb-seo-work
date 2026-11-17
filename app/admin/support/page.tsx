import Link from 'next/link'
import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { formatDateTime } from '@/lib/dates'
import { Card, PageHeader, StatusBadge, Table, Td } from '@/components/app/ui'

export const metadata = { title: 'Support | Admin' }

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin()
  const { t, locale } = await getT()
  const { status } = await searchParams
  const filter = status === 'RESOLVED' ? { status: 'RESOLVED' as const } : { status: { not: 'RESOLVED' as const } }
  const requests = await prisma.supportRequest.findMany({
    where: filter,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { booking: { select: { reference: true } }, school: { select: { name: true } }, assignee: { select: { name: true } } },
  })

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.support.title')} description={t('admin.support.subtitle')} />
      <div className="flex gap-2">
        <Link href="/admin/support" className={`px-3 py-1.5 rounded-full text-sm ${status !== 'RESOLVED' ? 'bg-primary text-white' : 'bg-white'}`}>
          {t('enums.supportStatus.OPEN')}
        </Link>
        <Link href="/admin/support?status=RESOLVED" className={`px-3 py-1.5 rounded-full text-sm ${status === 'RESOLVED' ? 'bg-primary text-white' : 'bg-white'}`}>
          {t('enums.supportStatus.RESOLVED')}
        </Link>
      </div>
      <Card>
        <Table head={[t('common.message'), t('common.status'), t('admin.bookings.school'), t('admin.support.assignee'), t('common.date')]} empty={t('common.noResults')}>
          {requests.map((r) => (
            <tr key={r.id} className="hover:bg-cream">
              <Td>
                <Link href={`/admin/support/${r.id}`} className="font-medium hover:text-primary">
                  {r.subject}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {t(`enums.supportType.${r.type}`)} · {r.email} {r.booking && `· ${r.booking.reference}`}
                </p>
              </Td>
              <Td>
                <StatusBadge status={r.status} label={t(`enums.supportStatus.${r.status}`)} />
              </Td>
              <Td>{r.school?.name ?? '–'}</Td>
              <Td>{r.assignee?.name ?? '–'}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt, locale)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
