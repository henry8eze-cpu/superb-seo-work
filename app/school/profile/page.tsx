import { prisma } from '@/lib/prisma'
import { requireSchoolActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDate } from '@/lib/dates'
import { setInstantBookingAction, setPayAtSchoolAction, updateProfileAction } from '@/app/actions/school'
import { ActionForm } from '@/components/app/action-form'
import { Card, DefinitionList, Field, inputClass, PageHeader, StatusBadge } from '@/components/app/ui'

export const metadata = { title: 'Profile | School app' }

export default async function SchoolProfilePage() {
  const actor = await requireSchoolActor()
  const { t, locale } = await getT()
  const school = await prisma.school.findUniqueOrThrow({ where: { id: actor.schoolId }, include: { city: true } })
  const isOwner = actor.schoolRole === 'OWNER' || actor.schoolRole === 'PLATFORM_ADMIN'

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={t('school.profile.title')} description={school.name} />

      <Card title={t('school.profile.status')}>
        <DefinitionList
          items={[
            [t('common.status'), <StatusBadge key="s" status={school.status} label={t(`enums.schoolStatus.${school.status}`)} />],
            [t('enums.schoolStatus.PARTNER'), school.partnerSince ? formatDate(school.partnerSince, locale) : '–'],
            [t('admin.schools.legalName'), school.legalName],
            [t('common.city'), school.city?.name],
          ]}
        />
      </Card>

      <Card title={t('school.profile.instantTitle')}>
        <p className="text-sm text-muted-foreground mb-4">{t('school.profile.instantHint')}</p>
        {school.status !== 'PARTNER' ? (
          <p className="text-sm text-blue-900 bg-blue-50 rounded-lg px-3 py-2">{t('school.notPartnerBanner')}</p>
        ) : !isOwner ? (
          <p className="text-sm">
            <StatusBadge status={school.instantBookingEnabled ? 'ACTIVE' : 'NONE'} label={school.instantBookingEnabled ? t('admin.school.instantOn') : t('admin.school.instantOff')} />{' '}
            <span className="text-muted-foreground">{t('school.profile.ownerOnly')}</span>
          </p>
        ) : (
          <div className="space-y-6">
            <ActionForm action={setInstantBookingAction} submitLabel={t('common.save')} successMessage={t('common.saved')}>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="enabled" defaultChecked={school.instantBookingEnabled} /> {t('school.profile.enable')}
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="agree" defaultChecked={school.instantBookingEnabled} className="mt-1" /> {t('school.profile.agree')}
              </label>
            </ActionForm>
            <ActionForm action={setPayAtSchoolAction} submitLabel={t('common.save')} successMessage={t('common.saved')} variant="secondary">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="enabled" defaultChecked={school.allowPayAtSchool} /> {t('school.profile.payAtSchool')}
              </label>
              <p className="text-xs text-muted-foreground">{t('school.profile.payAtSchoolHint')}</p>
            </ActionForm>
          </div>
        )}
      </Card>

      <Card title={t('school.profile.public')}>
        <ActionForm action={updateProfileAction} submitLabel={t('common.save')} successMessage={t('common.saved')}>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label={t('common.website')}>
              <input name="website" defaultValue={school.website ?? ''} className={inputClass} disabled={!actor.permissions.manageCourses} />
            </Field>
            <Field label={t('admin.schools.publicEmail')}>
              <input name="publicEmail" type="email" defaultValue={school.publicEmail ?? ''} className={inputClass} disabled={!actor.permissions.manageCourses} />
            </Field>
            <Field label={t('common.phone')}>
              <input name="phone" defaultValue={school.phone ?? ''} className={inputClass} disabled={!actor.permissions.manageCourses} />
            </Field>
          </div>
          <Field label={t('admin.schools.description')}>
            <textarea name="description" rows={5} defaultValue={school.description ?? ''} className={inputClass} disabled={!actor.permissions.manageCourses} />
          </Field>
        </ActionForm>
      </Card>
    </div>
  )
}
