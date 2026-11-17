import type { School } from '@prisma/client'
import type { Translate } from '@/lib/i18n'
import { Field, inputClass } from '@/components/app/ui'

const SCHOOL_TYPES = ['PRIVATE', 'VHS', 'UNIVERSITY', 'NON_PROFIT', 'OTHER'] as const
const CATEGORIES = ['STANDARD', 'INTENSIVE', 'EVENING', 'WEEKEND', 'PRIVATE', 'EXAM_PREP', 'INTEGRATION'] as const

/** Inputs for a school's researched details; used on "new" and "edit". */
export function SchoolFields({
  t,
  cities,
  languages,
  school,
}: {
  t: Translate
  cities: { id: string; name: string }[]
  languages: { code: string; nameEn: string; nameDe: string }[]
  school?: School
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label={`${t('common.name')} *`}>
        <input name="name" required defaultValue={school?.name} className={inputClass} />
      </Field>
      <Field label={t('admin.schools.legalName')} hint={t('admin.schools.legalNameHint')}>
        <input name="legalName" defaultValue={school?.legalName ?? ''} className={inputClass} />
      </Field>
      <Field label={t('admin.schools.type')}>
        <select name="schoolType" defaultValue={school?.schoolType ?? 'PRIVATE'} className={inputClass}>
          {SCHOOL_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`enums.schoolType.${type}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('common.city')}>
        <select name="cityId" defaultValue={school?.cityId ?? ''} className={inputClass}>
          <option value="">–</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('common.website')}>
        <input name="website" defaultValue={school?.website ?? ''} className={inputClass} placeholder="https://" />
      </Field>
      <Field label={t('admin.schools.publicEmail')}>
        <input name="publicEmail" type="email" defaultValue={school?.publicEmail ?? ''} className={inputClass} />
      </Field>
      <Field label={t('common.phone')}>
        <input name="phone" defaultValue={school?.phone ?? ''} className={inputClass} />
      </Field>
      <fieldset>
        <legend className="block text-sm font-medium text-dark-gray mb-1.5">{t('admin.schools.languages')}</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {languages.map((lang) => (
            <label key={lang.code} className="flex items-center gap-1.5">
              <input type="checkbox" name="languagesOffered" value={lang.code} defaultChecked={school?.languagesOffered.includes(lang.code)} />
              {lang.nameDe}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="md:col-span-2">
        <legend className="block text-sm font-medium text-dark-gray mb-1.5">{t('admin.schools.courseTypes')}</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-1.5">
              <input type="checkbox" name="courseTypesOffered" value={category} defaultChecked={school?.courseTypesOffered.includes(category)} />
              {t(`enums.category.${category}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t('admin.schools.description')} className="md:col-span-2">
        <textarea name="description" rows={3} defaultValue={school?.description ?? ''} className={inputClass} />
      </Field>
    </div>
  )
}

export function SourceTypeOptions({ t }: { t: Translate }) {
  return (
    <>
      {(['SCHOOL_WEBSITE', 'PUBLIC_REGISTRY', 'VHS_DIRECTORY', 'BAMF_LIST', 'PHONE_CALL', 'EMAIL', 'SCHOOL_PROVIDED', 'IMPORT', 'OTHER'] as const).map((type) => (
        <option key={type} value={type}>
          {t(`enums.sourceType.${type}`)}
        </option>
      ))}
    </>
  )
}
