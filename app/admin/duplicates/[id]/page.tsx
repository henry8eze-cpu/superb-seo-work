import { notFound } from 'next/navigation'
import type { School } from '@prisma/client'
import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { MERGEABLE_FIELDS } from '@/lib/services/school-research'
import { dismissDuplicateAction, mergeSchoolsAction } from '@/app/actions/admin-marketplace'
import { ActionButton, ActionForm } from '@/components/app/action-form'
import { Badge, Card, PageHeader, StatusBadge } from '@/components/app/ui'

export const metadata = { title: 'Merge duplicates | Admin' }

type WithRelations = School & { city: { name: string } | null; _count: { sources: number; contactAttempts: number; branches: number; courseTypes: number; memberships: number } }

export default async function DuplicatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const { t } = await getT()

  const include = { city: { select: { name: true } }, _count: { select: { sources: true, contactAttempts: true, branches: true, courseTypes: true, memberships: true } } } as const
  const candidate = await prisma.duplicateCandidate.findUnique({ where: { id }, include: { school: { include }, otherSchool: { include } } })
  if (!candidate) notFound()

  // Suggest keeping the record that is further along (partner/verified, more history).
  const rank = (s: WithRelations) =>
    ({ PARTNER: 3, VERIFIED: 2, DISCOVERED: 1, INACTIVE: 0 })[s.status] * 1000 + s._count.memberships * 100 + s._count.courseTypes * 10 + s._count.sources
  const [keep, remove] = rank(candidate.school) >= rank(candidate.otherSchool) ? [candidate.school, candidate.otherSchool] : [candidate.otherSchool, candidate.school]

  const display = (school: WithRelations, field: (typeof MERGEABLE_FIELDS)[number]) => {
    if (field === 'cityId') return school.city?.name ?? '–'
    if (field === 'schoolType') return t(`enums.schoolType.${school.schoolType}`)
    return (school[field] as string | null) || '–'
  }

  const fieldLabels: Record<(typeof MERGEABLE_FIELDS)[number], string> = {
    name: t('common.name'),
    legalName: t('admin.schools.legalName'),
    website: t('common.website'),
    publicEmail: t('admin.schools.publicEmail'),
    phone: t('common.phone'),
    schoolType: t('admin.schools.type'),
    cityId: t('common.city'),
    description: t('admin.schools.description'),
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        back={{ href: '/admin/duplicates', label: t('admin.duplicates.title') }}
        title={`${candidate.school.name} ↔ ${candidate.otherSchool.name}`}
        description={
          <span className="flex flex-wrap gap-1">
            {candidate.score}% ·{' '}
            {candidate.reasons.map((r) => (
              <Badge key={r} tone="orange">
                {t(`admin.duplicates.reason.${r}`)}
              </Badge>
            ))}
          </span>
        }
        actions={
          candidate.status === 'OPEN' && (
            <ActionButton action={dismissDuplicateAction.bind(null, candidate.id)} redirectTo="/admin/duplicates" successMessage={t('common.saved')}>
              {t('admin.duplicates.notDuplicate')}
            </ActionButton>
          )
        }
      />

      {candidate.status !== 'OPEN' ? (
        <Card>
          <StatusBadge status={candidate.status} label={candidate.status} />
        </Card>
      ) : (
        <Card title={t('admin.duplicates.merge')}>
          <p className="text-sm text-muted-foreground mb-4">{t('admin.duplicates.mergeHint')}</p>
          <ActionForm
            action={mergeSchoolsAction.bind(null, candidate.id)}
            submitLabel={t('admin.duplicates.merge')}
            successMessage={t('admin.duplicates.merged')}
            redirectTo="/admin/schools/:id"
            confirmMessage={t('common.areYouSure')}
          >
            <input type="hidden" name="keepId" value={keep.id} />
            <input type="hidden" name="removeId" value={remove.id} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream">
                    <th className="text-left px-3 py-2 w-40" />
                    <th className="text-left px-3 py-2">
                      {t('admin.duplicates.keep')}: <a className="text-primary underline" href={`/admin/schools/${keep.id}`}>{keep.name}</a>{' '}
                      <StatusBadge status={keep.status} label={t(`enums.schoolStatus.${keep.status}`)} />
                    </th>
                    <th className="text-left px-3 py-2">
                      <a className="text-primary underline" href={`/admin/schools/${remove.id}`}>{remove.name}</a>{' '}
                      <StatusBadge status={remove.status} label={t(`enums.schoolStatus.${remove.status}`)} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MERGEABLE_FIELDS.map((field) => {
                    const a = display(keep, field)
                    const b = display(remove, field)
                    const same = a === b
                    return (
                      <tr key={field} className="border-b border-border">
                        <td className="px-3 py-2 font-medium">{fieldLabels[field]}</td>
                        <td className="px-3 py-2">
                          <label className="flex items-start gap-2">
                            <input type="radio" name={`field_${field}`} value="keep" defaultChecked={!(a === '–' && b !== '–')} disabled={same} />
                            <span className="break-all">{a}</span>
                          </label>
                        </td>
                        <td className="px-3 py-2">
                          <label className="flex items-start gap-2">
                            <input type="radio" name={`field_${field}`} value="remove" defaultChecked={a === '–' && b !== '–'} disabled={same} />
                            <span className="break-all">{b}</span>
                          </label>
                        </td>
                      </tr>
                    )
                  })}
                  <tr>
                    <td className="px-3 py-2 font-medium">{t('admin.school.sources')}</td>
                    <td className="px-3 py-2">{keep._count.sources}</td>
                    <td className="px-3 py-2">{remove._count.sources}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">{t('admin.school.contactLog')}</td>
                    <td className="px-3 py-2">{keep._count.contactAttempts}</td>
                    <td className="px-3 py-2">{remove._count.contactAttempts}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  )
}
