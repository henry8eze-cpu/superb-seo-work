'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/language-context'
import { importSchoolsAction } from '@/app/actions/admin-marketplace'
import type { ImportResult } from '@/lib/services/school-research'
import { buttonClass, Field, inputClass } from '@/components/app/ui'

export function ImportForm({ cities, defaultCityId }: { cities: { id: string; name: string }[]; defaultCityId?: string }) {
  const { t } = useLanguage()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ImportResult | null>(null)

  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          startTransition(async () => {
            try {
              const response = await importSchoolsAction(form)
              if (!response.success) {
                toast.error(response.error)
                return
              }
              const data = response.data as ImportResult
              setResult(data)
              toast.success(t('admin.import.result', { created: data.created, existing: data.existing, skipped: data.skipped, duplicates: data.duplicatesFlagged }))
            } catch {
              toast.error(t('feedback.networkError'))
            }
          })
        }}
      >
        <Field label={t('admin.import.cityDefault')}>
          <select name="cityId" defaultValue={defaultCityId ?? ''} className={inputClass}>
            <option value="">–</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.import.file')}>
          <input type="file" name="file" accept=".csv,text/csv" className="block text-sm" />
        </Field>
        <Field label={t('admin.import.paste')}>
          <textarea name="csv" rows={6} className={`${inputClass} font-mono text-xs`} placeholder={'name;website;phone;address;plz;city;source_url\n…'} />
        </Field>
        <button className={buttonClass} disabled={pending}>
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('admin.import.run')}
        </button>
      </form>

      {result && (
        <div className="space-y-3">
          <p className="font-medium">
            {t('admin.import.result', { created: result.created, existing: result.existing, skipped: result.skipped, duplicates: result.duplicatesFlagged })}
          </p>
          {result.duplicatesFlagged > 0 && (
            <Link href="/admin/duplicates" className="text-primary underline text-sm">
              {t('admin.import.duplicatesFound', { count: result.duplicatesFlagged })}
            </Link>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream">
                <tr>
                  <th className="text-left px-3 py-2">{t('admin.import.row')}</th>
                  <th className="text-left px-3 py-2">{t('common.name')}</th>
                  <th className="text-left px-3 py-2">{t('admin.import.outcome')}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.row} className="border-b border-border">
                    <td className="px-3 py-2">{row.row}</td>
                    <td className="px-3 py-2">
                      {row.schoolId ? (
                        <Link href={`/admin/schools/${row.schoolId}`} className="hover:text-primary">
                          {row.name}
                        </Link>
                      ) : (
                        row.name || '–'
                      )}
                    </td>
                    <td className={`px-3 py-2 ${row.outcome === 'skipped' ? 'text-red-700' : ''}`}>
                      {t(`admin.import.${row.outcome}`)}
                      {row.error && ` – ${t(`admin.import.${row.error}`)}`}
                      {row.duplicates ? ` · ${t('admin.import.duplicatesFound', { count: row.duplicates })}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
