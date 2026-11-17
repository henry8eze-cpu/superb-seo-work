import type { CourseType } from '@prisma/client'
import { languageName, type Translate } from '@/lib/i18n'
import { Field, inputClass } from '@/components/app/ui'
import { LocationPicker, type PickerBranch } from './location-picker'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
const CATEGORIES = ['STANDARD', 'INTENSIVE', 'EVENING', 'WEEKEND', 'PRIVATE', 'EXAM_PREP', 'INTEGRATION'] as const
const FORMATS = ['IN_PERSON', 'ONLINE', 'HYBRID'] as const

export function CourseFields({
  t,
  locale,
  branches,
  languages,
  course,
  disabled,
}: {
  t: Translate
  locale: string
  branches: PickerBranch[]
  languages: { code: string; nameEn: string; nameDe: string }[]
  course?: CourseType
  disabled?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="grid md:grid-cols-2 gap-4">
      <Field label={`${t('school.courses.name')} *`} className="md:col-span-2">
        <input name="name" required defaultValue={course?.name} placeholder={t('school.courses.namePlaceholder')} className={inputClass} />
      </Field>
      <div className="md:col-span-2">
        <LocationPicker branches={branches} defaultBranchId={course?.branchId} disabled={disabled} />
      </div>
      <Field label={t('school.courses.language')}>
        <select name="languageCode" defaultValue={course?.languageCode ?? 'de'} className={inputClass}>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {languageName(l, locale)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('school.courses.level')}>
        <select name="level" defaultValue={course?.level ?? 'A1'} className={inputClass}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(`enums.level.${l}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('school.courses.category')}>
        <select name="category" defaultValue={course?.category ?? 'STANDARD'} className={inputClass}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`enums.category.${c}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('school.courses.format')}>
        <select name="format" defaultValue={course?.format ?? 'IN_PERSON'} className={inputClass}>
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {t(`enums.format.${f}`)}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('school.courses.lessonsPerWeek')}>
          <input name="lessonsPerWeek" type="number" min={1} max={60} required defaultValue={course?.lessonsPerWeek ?? 6} className={inputClass} />
        </Field>
        <Field label={t('school.courses.lessonMinutes')}>
          <input name="lessonMinutes" type="number" min={15} max={300} defaultValue={course?.lessonMinutes ?? 45} className={inputClass} />
        </Field>
      </div>
      <Field label={t('admin.schools.description')} className="md:col-span-2">
        <textarea name="description" rows={3} defaultValue={course?.description ?? ''} className={inputClass} />
      </Field>
      <Field label={`${t('school.courses.cancellationTerms')} *`} className="md:col-span-2">
        <textarea name="cancellationTerms" rows={3} required minLength={10} defaultValue={course?.cancellationTerms} placeholder={t('school.courses.cancellationPlaceholder')} className={inputClass} />
      </Field>
    </fieldset>
  )
}
