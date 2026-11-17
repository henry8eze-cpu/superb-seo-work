import { prisma } from '@/lib/prisma'
import { requireSchoolActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDate } from '@/lib/dates'
import { inviteStaffAction, removeMemberAction, revokeStaffInvitationAction, updateMemberAction } from '@/app/actions/school'
import { ActionButton, ActionForm } from '@/components/app/action-form'
import { Badge, Card, Field, inputClass, PageHeader } from '@/components/app/ui'

export const metadata = { title: 'Team | School app' }

const PERMS = ['canManageCourses', 'canManageBookings', 'canViewFinances', 'canManageStaff'] as const

export default async function TeamPage() {
  const actor = await requireSchoolActor()
  const { t, locale } = await getT()
  const [members, invitations] = await Promise.all([
    prisma.schoolMembership.findMany({ where: { schoolId: actor.schoolId, status: 'ACTIVE' }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.schoolInvitation.findMany({
      where: { schoolId: actor.schoolId, kind: 'STAFF', acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  const canManage = actor.permissions.manageStaff

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={t('school.team.title')} description={t('school.team.subtitle')} />
      <Card>
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="py-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  <span className="font-medium">{m.user.name}</span> <span className="text-sm text-muted-foreground">· {m.user.email}</span>{' '}
                  <Badge tone={m.role === 'OWNER' ? 'primary' : 'gray'}>{t(`enums.membershipRole.${m.role}`)}</Badge>
                </p>
                {canManage && m.userId !== actor.userId && (
                  <ActionButton action={removeMemberAction.bind(null, m.id)} variant="danger" confirmMessage={t('common.areYouSure')} className="px-2 py-1 text-xs">
                    {t('school.team.remove')}
                  </ActionButton>
                )}
              </div>
              {m.role === 'STAFF' &&
                (canManage ? (
                  <ActionForm action={updateMemberAction.bind(null, m.id)} submitLabel={t('common.save')} variant="secondary" successMessage={t('common.saved')} className="flex flex-wrap items-center gap-4 space-y-0" submitClassName="px-3 py-1 text-xs">
                    {PERMS.map((p) => (
                      <label key={p} className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" name={p} defaultChecked={m[p]} /> {t(`school.team.perm.${p}`)}
                      </label>
                    ))}
                  </ActionForm>
                ) : (
                  <p className="flex flex-wrap gap-1">
                    {PERMS.filter((p) => m[p]).map((p) => (
                      <Badge key={p}>{t(`school.team.perm.${p}`)}</Badge>
                    ))}
                  </p>
                ))}
            </li>
          ))}
        </ul>
      </Card>

      {canManage && (
        <Card title={t('school.team.invite')}>
          <ActionForm action={inviteStaffAction} submitLabel={t('school.team.invite')} successMessage={t('school.team.invited')} resetOnSuccess>
            <Field label={t('common.email')}>
              <input name="email" type="email" required className={inputClass} />
            </Field>
            <div className="flex flex-wrap gap-4">
              {PERMS.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name={p} defaultChecked={p === 'canManageBookings'} /> {t(`school.team.perm.${p}`)}
                </label>
              ))}
            </div>
          </ActionForm>
          {invitations.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold text-sm mb-2">{t('school.team.pending')}</h4>
              <ul className="text-sm space-y-2">
                {invitations.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2">
                    <span>
                      {inv.email} <span className="text-xs text-muted-foreground">· {t('admin.school.expires', { date: formatDate(inv.expiresAt, locale) })}</span>
                    </span>
                    <ActionButton action={revokeStaffInvitationAction.bind(null, inv.id)} className="px-2 py-1 text-xs">
                      {t('admin.school.revoke')}
                    </ActionButton>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
