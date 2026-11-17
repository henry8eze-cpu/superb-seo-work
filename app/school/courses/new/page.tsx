import { prisma } from '@/lib/prisma'
import { requireSchoolActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { createCourseWithIntakeAction } from '@/app/actions/school'
import { ActionForm } from '@/components/app/action-form'
import { Card, PageHeader } from '@/components/app/ui'
import { CourseFields } from '@/components/school/course-fields'
import { IntakeFields } from '@/components/school/intake-form'

export const metadata = { title: 'New course | School app' }

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-full bg-primary text-white font-poppins font-bold flex items-center justify-center shrink-0">{step}</span>
        <div>
          <h3 className="font-poppins text-lg font-bold text-dark-gray">{title}</h3>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export default async function NewCoursePage() {
  const actor = await requireSchoolActor()
  const { t, locale } = await getT()
  const [branches, languages] = await Promise.all([
    prisma.branch.findMany({ where: { schoolId: actor.schoolId, archivedAt: null }, orderBy: [{ isOnline: 'asc' }, { name: 'asc' }] }),
    prisma.language.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ])

  return (
    <div className="max-w-4xl">
      <PageHeader title={t('school.courses.new')} description={t('school.courses.newSubtitle')} back={{ href: '/school/courses', label: t('school.courses.title') }} />
      <Card className="rounded-2xl">
        {!actor.permissions.manageCourses ? (
          <p className="text-sm">{t('school.noPermission')}</p>
        ) : (
          <ActionForm
            action={createCourseWithIntakeAction}
            submitLabel={t('school.courses.createWithDate')}
            successMessage={t('school.courses.created')}
            redirectTo="/school/courses/:id"
            className="space-y-10"
            submitClassName="w-full sm:w-auto px-6 py-3"
          >
            <Section step={1} title={t('school.courses.sectionCourse')}>
              <CourseFields t={t} locale={locale} branches={branches} languages={languages} />
            </Section>
            <Section step={2} title={t('school.courses.sectionFirstDate')} hint={t('school.courses.firstDateHint')}>
              <IntakeFields />
            </Section>
          </ActionForm>
        )}
      </Card>
    </div>
  )
}
