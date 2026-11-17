import Link from 'next/link'
import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { Badge, Card, PageHeader, Table, Td } from '@/components/app/ui'

export const metadata = { title: 'Duplicates | Admin' }

export default async function DuplicatesPage() {
  await requireAdmin()
  const { t } = await getT()
  const candidates = await prisma.duplicateCandidate.findMany({
    where: { status: 'OPEN' },
    orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    take: 200,
    include: {
      school: { select: { id: true, name: true, city: { select: { name: true } } } },
      otherSchool: { select: { id: true, name: true, city: { select: { name: true } } } },
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.duplicates.title')} description={t('admin.duplicates.subtitle')} />
      <Card>
        <Table head={['A', 'B', t('admin.duplicates.score'), t('admin.duplicates.reasons'), '']} empty={t('common.noResults')}>
          {candidates.map((c) => (
            <tr key={c.id} className="hover:bg-cream">
              <Td>
                {c.school.name}
                <p className="text-xs text-muted-foreground">{c.school.city?.name}</p>
              </Td>
              <Td>
                {c.otherSchool.name}
                <p className="text-xs text-muted-foreground">{c.otherSchool.city?.name}</p>
              </Td>
              <Td className="font-semibold">{c.score}%</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {c.reasons.map((r) => (
                    <Badge key={r} tone="orange">
                      {t(`admin.duplicates.reason.${r}`)}
                    </Badge>
                  ))}
                </div>
              </Td>
              <Td>
                <Link href={`/admin/duplicates/${c.id}`} className="text-primary font-medium hover:underline">
                  {t('admin.duplicates.review')}
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
