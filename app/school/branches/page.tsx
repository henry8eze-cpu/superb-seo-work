import { prisma } from '@/lib/prisma'
import { requireSchoolActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { archiveBranchAction, createBranchAction, updateBranchAction } from '@/app/actions/school'
import { ActionButton, ActionForm } from '@/components/app/action-form'
import { Card, PageHeader } from '@/components/app/ui'
import { BranchFields } from '@/components/school/branch-fields'

export const metadata = { title: 'Branches | School app' }

export default async function BranchesPage() {
  const actor = await requireSchoolActor()
  const { t } = await getT()
  const branches = await prisma.branch.findMany({
    where: { schoolId: actor.schoolId, archivedAt: null },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { courseTypes: true } } },
  })
  const canEdit = actor.permissions.manageCourses

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={t('school.branches.title')} description={t('school.branches.subtitle')} />
      {branches.map((branch) => (
        <Card
          key={branch.id}
          title={branch.name}
          actions={
            canEdit && branch._count.courseTypes === 0 ? (
              <ActionButton action={archiveBranchAction.bind(null, branch.id)} variant="danger" confirmMessage={t('common.areYouSure')} className="px-2 py-1 text-xs">
                {t('school.branches.archive')}
              </ActionButton>
            ) : undefined
          }
        >
          {canEdit ? (
            <ActionForm action={updateBranchAction.bind(null, branch.id)} submitLabel={t('common.save')} successMessage={t('common.saved')}>
              <BranchFields t={t} branch={branch} />
            </ActionForm>
          ) : (
            <p className="text-sm">{branch.isOnline ? t('common.online') : [branch.address, branch.postcode, branch.cityName].filter(Boolean).join(', ')}</p>
          )}
        </Card>
      ))}
      {canEdit && (
        <Card title={t('school.branches.new')}>
          <ActionForm action={createBranchAction} submitLabel={t('common.create')} successMessage={t('common.saved')} resetOnSuccess>
            <BranchFields t={t} />
          </ActionForm>
        </Card>
      )}
    </div>
  )
}
