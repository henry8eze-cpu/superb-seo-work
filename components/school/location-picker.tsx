'use client'

import { useId, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { GERMAN_CITIES } from '@/lib/data/german-cities'
import { Field, inputClass } from '@/components/app/ui'

export const NEW_LOCATION = '__new'
export const NEW_ONLINE = '__online'

export type PickerBranch = { id: string; name: string; isOnline: boolean; address: string | null; postcode: string | null; cityName: string | null }

/**
 * Where a course takes place: an existing location, a new address anywhere in
 * Germany (saved as a branch on submit), or online.
 */
export function LocationPicker({ branches, defaultBranchId, disabled }: { branches: PickerBranch[]; defaultBranchId?: string; disabled?: boolean }) {
  const { t } = useLanguage()
  const listId = useId()
  const hasOnline = branches.some((b) => b.isOnline)
  const physical = branches.filter((b) => !b.isOnline)
  const [choice, setChoice] = useState(defaultBranchId ?? (physical[0]?.id ?? NEW_LOCATION))

  const describe = (b: PickerBranch) => (b.isOnline ? t('common.online') : [b.name, [b.postcode, b.cityName].filter(Boolean).join(' ')].filter(Boolean).join(' – '))

  return (
    <fieldset disabled={disabled} className="space-y-3">
      <Field label={`${t('school.courses.location')} *`}>
        <select name="branchId" value={choice} onChange={(e) => setChoice(e.target.value)} className={inputClass}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {describe(b)}
            </option>
          ))}
          <option value={NEW_LOCATION}>＋ {t('school.courses.newLocation')}</option>
          {!hasOnline && <option value={NEW_ONLINE}>＋ {t('school.courses.onlineLocation')}</option>}
        </select>
      </Field>

      {choice === NEW_LOCATION && (
        <div className="rounded-xl border border-dashed border-primary/40 bg-cream/60 p-4 space-y-3">
          <p className="flex items-center gap-2 text-sm font-medium text-dark-gray">
            <MapPin className="w-4 h-4 text-primary" />
            {t('school.courses.newLocationHint')}
          </p>
          <div className="grid sm:grid-cols-[1fr_8rem_1fr] gap-3">
            <Field label={`${t('common.address')} *`}>
              <input name="newAddress" required autoComplete="street-address" placeholder="Musterstraße 1" className={inputClass} />
            </Field>
            <Field label={`${t('common.postcode')} *`}>
              <input
                name="newPostcode"
                required
                inputMode="numeric"
                pattern="\d{5}"
                maxLength={5}
                title={t('school.courses.postcodeFormat')}
                autoComplete="postal-code"
                placeholder="10115"
                className={inputClass}
              />
            </Field>
            <Field label={`${t('common.city')} *`}>
              <input name="newCity" required list={listId} autoComplete="address-level2" placeholder="Berlin" className={inputClass} />
              <datalist id={listId}>
                {GERMAN_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>
          <Field label={t('school.courses.locationName')} hint={t('school.courses.locationNameHint')}>
            <input name="newBranchName" className={inputClass} />
          </Field>
        </div>
      )}
      {choice === NEW_ONLINE && <p className="text-xs text-muted-foreground">{t('school.courses.onlineLocationHint')}</p>}
    </fieldset>
  )
}
