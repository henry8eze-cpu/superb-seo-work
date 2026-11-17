import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { Card, PageHeader } from '@/components/app/ui'
import { ImportForm } from '@/components/admin/import-form'
import { formatDateTime } from '@/lib/dates'

export const metadata = { title: 'Import | Admin' }

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  await requireAdmin()
  const { t, locale } = await getT()
  const { city } = await searchParams
  const [cities, batches] = await Promise.all([
    prisma.city.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
    prisma.importBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { city: true, createdBy: { select: { name: true } } } }),
  ])

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={t('admin.import.title')} description={t('admin.import.subtitle')} />
      <Card>
        <ImportForm cities={cities} defaultCityId={city} />
      </Card>
      {batches.length > 0 && (
        <Card title={t('admin.school.history')}>
          <ul className="text-sm divide-y divide-border">
            {batches.map((batch) => (
              <li key={batch.id} className="py-2">
                {formatDateTime(batch.createdAt, locale)} · {batch.city?.name ?? '–'} · {batch.fileName ?? 'CSV'} · {batch.createdBy.name} —{' '}
                {t('admin.import.result', { created: batch.createdCount, existing: batch.rowCount - batch.createdCount - batch.skippedCount, skipped: batch.skippedCount, duplicates: batch.duplicateCount })}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
