import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { createSchoolAction } from '@/app/actions/admin-marketplace'
import { ActionForm } from '@/components/app/action-form'
import { Card, Field, inputClass, PageHeader } from '@/components/app/ui'
import { SchoolFields, SourceTypeOptions } from '@/components/admin/school-fields'

export const metadata = { title: 'New school | Admin' }

export default async function NewSchoolPage() {
  await requireAdmin()
  const { t } = await getT()
  const [cities, languages] = await Promise.all([
    prisma.city.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] }),
    prisma.language.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ])

  return (
    <div className="max-w-3xl">
      <PageHeader title={t('admin.schools.new')} back={{ href: '/admin/schools', label: t('admin.schools.title') }} />
      <Card>
        <ActionForm
          action={createSchoolAction}
          submitLabel={t('common.create')}
          successMessage={t('admin.schools.created')}
          redirectTo="/admin/schools/:id"
        >
          <SchoolFields t={t} cities={cities} languages={languages} />
          <fieldset className="border-t border-border pt-4 grid md:grid-cols-2 gap-4">
            <legend className="font-poppins font-semibold text-dark-gray">{t('admin.schools.firstSource')}</legend>
            <Field label={t('admin.schools.sourceUrl')} hint={t('admin.schools.sourceUrlHint')} className="md:col-span-2">
              <input name="sourceUrl" className={inputClass} placeholder="https://…/impressum" />
            </Field>
            <Field label={t('common.status')}>
              <select name="sourceType" defaultValue="SCHOOL_WEBSITE" className={inputClass}>
                <SourceTypeOptions t={t} />
              </select>
            </Field>
            <Field label={t('common.notes')}>
              <input name="sourceNotes" className={inputClass} />
            </Field>
          </fieldset>
        </ActionForm>
      </Card>
    </div>
  )
}
