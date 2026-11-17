'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { formatMoney } from '@/lib/money'
import { ActionForm, type ActionResponse } from '@/components/app/action-form'
import { Field, inputClass, secondaryButtonClass } from '@/components/app/ui'

export type IntakeFormValues = {
  startDate: string
  endDate: string
  weekdays: number[]
  startTime: string
  endTime: string
  price: string
  capacity: number
  bookingDeadline: string
  instantBooking: boolean
  fees: { label: string; amount: string; compulsory: boolean }[]
}

const toCents = (value: string) => {
  const n = Number(value.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export function IntakeForm({
  action,
  initial,
  submitLabel,
  successMessage,
  redirectTo,
  disabled,
}: {
  action: (form: FormData) => Promise<ActionResponse>
  initial?: IntakeFormValues
  submitLabel: string
  successMessage: string
  redirectTo?: string
  disabled?: boolean
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel} successMessage={successMessage} redirectTo={redirectTo}>
      <IntakeFields initial={initial} disabled={disabled} />
    </ActionForm>
  )
}

/** Date, schedule, price, fees and seats of one intake. Used on its own form and inside "New course". */
export function IntakeFields({ initial, disabled }: { initial?: IntakeFormValues; disabled?: boolean }) {
  const { t, language } = useLanguage()
  const [fees, setFees] = useState(initial?.fees ?? [])
  const [price, setPrice] = useState(initial?.price ?? '')
  const total = toCents(price) + fees.filter((f) => f.compulsory).reduce((sum, f) => sum + toCents(f.amount), 0)

  return (
      <fieldset disabled={disabled} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={`${t('school.intake.startDate')} *`}>
            <input type="date" name="startDate" required defaultValue={initial?.startDate} className={inputClass} />
          </Field>
          <Field label={`${t('school.intake.endDate')} *`}>
            <input type="date" name="endDate" required defaultValue={initial?.endDate} className={inputClass} />
          </Field>
        </div>
        <fieldset>
          <legend className="block text-sm font-medium text-dark-gray mb-1.5">{t('school.intake.weekdays')} *</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <label key={d} className="flex items-center gap-1.5 text-sm border border-border rounded-lg px-3 py-1.5 has-[:checked]:bg-primary has-[:checked]:text-white has-[:checked]:border-primary cursor-pointer">
                <input type="checkbox" name="weekdays" value={d} defaultChecked={initial?.weekdays.includes(d)} className="sr-only" />
                {t(`weekdays.short.${d}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-4">
          <Field label={`${t('school.intake.startTime')} *`}>
            <input type="time" name="startTime" required defaultValue={initial?.startTime ?? '18:00'} className={inputClass} />
          </Field>
          <Field label={`${t('school.intake.endTime')} *`}>
            <input type="time" name="endTime" required defaultValue={initial?.endTime ?? '20:15'} className={inputClass} />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={`${t('school.intake.price')} *`}>
            <input name="price" inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} placeholder="399" />
          </Field>
          <Field label={`${t('school.intake.capacity')} *`} hint={t('school.intake.capacityHint')}>
            <input type="number" name="capacity" min={1} max={500} required defaultValue={initial?.capacity ?? 12} className={inputClass} />
          </Field>
        </div>
        <Field label={t('school.intake.deadline')} hint={t('school.intake.deadlineHint')}>
          <input type="datetime-local" name="bookingDeadline" defaultValue={initial?.bookingDeadline} className={inputClass} />
        </Field>

        <fieldset className="space-y-2">
          <legend className="block text-sm font-medium text-dark-gray">{t('school.intake.fees')}</legend>
          <p className="text-xs text-muted-foreground">{t('school.intake.feesHint')}</p>
          {fees.map((fee, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_auto_auto] gap-2 items-center">
              <input
                aria-label={t('school.intake.feeLabel')}
                placeholder={t('school.intake.feeLabel')}
                value={fee.label}
                onChange={(e) => setFees(fees.map((f, j) => (j === i ? { ...f, label: e.target.value } : f)))}
                className={inputClass}
              />
              <input
                aria-label={t('school.intake.feeAmount')}
                placeholder="0,00"
                inputMode="decimal"
                value={fee.amount}
                onChange={(e) => setFees(fees.map((f, j) => (j === i ? { ...f, amount: e.target.value } : f)))}
                className={inputClass}
              />
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={fee.compulsory} onChange={(e) => setFees(fees.map((f, j) => (j === i ? { ...f, compulsory: e.target.checked } : f)))} />
                {t('school.intake.compulsory')}
              </label>
              <button type="button" onClick={() => setFees(fees.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-600" aria-label={t('common.delete')}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setFees([...fees, { label: '', amount: '', compulsory: true }])} className={`${secondaryButtonClass} px-3 py-1 text-xs`}>
            <Plus className="w-3 h-3" /> {t('school.intake.addFee')}
          </button>
          <input type="hidden" name="fees" value={JSON.stringify(fees)} />
        </fieldset>

        <p className="text-sm font-semibold">{t('school.intake.totalPrice', { price: formatMoney(total, 'EUR', language) })}</p>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="instantBooking" defaultChecked={initial?.instantBooking ?? true} /> {t('school.intake.instantBooking')}
        </label>
        {initial && <p className="text-xs text-muted-foreground">{t('school.intake.saveHint')}</p>}
      </fieldset>
  )
}
