import type { Branch } from '@prisma/client'
import type { Translate } from '@/lib/i18n'
import { Field, inputClass } from '@/components/app/ui'

export function BranchFields({ t, branch }: { t: Translate; branch?: Branch }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label={`${t('common.name')} *`}>
        <input name="name" required defaultValue={branch?.name} className={inputClass} placeholder="Essen Mitte" />
      </Field>
      <Field label={t('common.phone')}>
        <input name="phone" defaultValue={branch?.phone ?? ''} className={inputClass} />
      </Field>
      <Field label={t('common.address')} className="md:col-span-2">
        <input name="address" defaultValue={branch?.address ?? ''} className={inputClass} placeholder="Musterstraße 1" />
      </Field>
      <Field label={t('common.postcode')}>
        <input name="postcode" defaultValue={branch?.postcode ?? ''} className={inputClass} inputMode="numeric" maxLength={5} />
      </Field>
      <Field label={t('common.city')}>
        <input name="cityName" defaultValue={branch?.cityName ?? ''} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" name="isOnline" defaultChecked={branch?.isOnline} /> {t('admin.school.isOnline')}
      </label>
    </div>
  )
}
