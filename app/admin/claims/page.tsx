import Link from 'next/link'
import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { formatDateTime } from '@/lib/dates'
import { Badge, Card, PageHeader, StatusBadge, Table, Td } from '@/components/app/ui'

export const metadata = { title: 'Claims | Admin' }

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin()
  const { t, locale } = await getT()
  const { status } = await searchParams
  const filter = status === 'APPROVED' || status === 'REJECTED' ? status : 'PENDING'
  const claims = await prisma.profileClaim.findMany({
    where: { status: filter },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { school: { select: { name: true, city: { select: { name: true } } } }, _count: { select: { documents: true } } },
  })

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.claims.title')} description={t('admin.claims.subtitle')} />
      <div className="flex gap-2">
        {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
          <Link key={s} href={`/admin/claims?status=${s}`} className={`px-3 py-1.5 rounded-full text-sm ${filter === s ? 'bg-primary text-white' : 'bg-white'}`}>
            {t(`enums.claimStatus.${s}`)}
          </Link>
        ))}
      </div>
      <Card>
        <Table head={[t('admin.bookings.school'), t('admin.claims.claimant'), t('admin.claims.documents'), t('common.date'), t('common.status')]} empty={t('common.noResults')}>
          {claims.map((claim) => (
            <tr key={claim.id} className="hover:bg-cream">
              <Td>
                <Link href={`/admin/claims/${claim.id}`} className="font-medium hover:text-primary">
                  {claim.school.name}
                </Link>
                <p className="text-xs text-muted-foreground">{claim.school.city?.name}</p>
              </Td>
              <Td>
                {claim.claimantName} · {claim.claimantPosition}
                <p className="text-xs text-muted-foreground">{claim.claimantEmail}</p>
              </Td>
              <Td>
                <Badge tone={claim.emailDomainMatches ? 'green' : 'orange'}>
                  {claim.emailDomainMatches ? t('admin.claims.domainMatch') : t('admin.claims.domainMismatch')}
                </Badge>{' '}
                {claim._count.documents > 0 && <Badge tone="blue">📎 {claim._count.documents}</Badge>}
              </Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(claim.createdAt, locale)}</Td>
              <Td>
                <StatusBadge status={claim.status} label={t(`enums.claimStatus.${claim.status}`)} />
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
