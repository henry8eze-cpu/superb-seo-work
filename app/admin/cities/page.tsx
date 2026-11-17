import Link from 'next/link'
import { requireAdmin } from '@/app/actions/auth'
import { getT } from '@/lib/i18n/server'
import { getCityCoverage } from '@/lib/services/school-research'
import { createCityAction, setCityStatusAction } from '@/app/actions/admin-marketplace'
import { ActionForm } from '@/components/app/action-form'
import { Card, Field, inputClass, PageHeader, StatusBadge, Table, Td } from '@/components/app/ui'

export const metadata = { title: 'Coverage | Admin' }

export default async function CitiesPage() {
  await requireAdmin()
  const { t } = await getT()
  const cities = await getCityCoverage()
  const totals = cities.reduce(
    (acc, c) => ({
      total: acc.total + c.total - c.inactive,
      verified: acc.verified + c.verified,
      partner: acc.partner + c.partner,
      contacted: acc.contacted + c.contacted,
    }),
    { total: 0, verified: 0, partner: 0, contacted: 0 }
  )

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.cities.title')} description={t('admin.cities.subtitle')} />

      <Card>
        <Table
          head={[
            t('admin.cities.city'),
            t('admin.cities.research'),
            t('enums.schoolStatus.DISCOVERED'),
            t('enums.schoolStatus.VERIFIED'),
            t('enums.schoolStatus.PARTNER'),
            t('enums.schoolStatus.INACTIVE'),
            t('admin.cities.contacted'),
            t('admin.cities.invited'),
            '',
          ]}
          empty={t('common.noResults')}
        >
          {cities.map((city) => (
            <tr key={city.id} className="hover:bg-cream">
              <Td>
                <Link href={`/admin/schools?city=${city.id}`} className="font-medium hover:text-primary">
                  {city.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {t('admin.cities.priority')} {city.priority}
                </p>
              </Td>
              <Td>
                <ActionForm action={setCityStatusAction.bind(null, city.id)} submitLabel={t('common.save')} variant="secondary" className="flex items-center gap-2 space-y-0" submitClassName="px-2 py-1 text-xs">
                  <select name="status" defaultValue={city.researchStatus} className={`${inputClass} py-1 text-xs w-auto`}>
                    {(['NOT_STARTED', 'IN_PROGRESS', 'DONE'] as const).map((s) => (
                      <option key={s} value={s}>
                        {t(`enums.researchStatus.${s}`)}
                      </option>
                    ))}
                  </select>
                </ActionForm>
              </Td>
              <Td>
                <Link href={`/admin/schools?city=${city.id}&status=DISCOVERED`} className="hover:text-primary">{city.discovered}</Link>
              </Td>
              <Td>
                <Link href={`/admin/schools?city=${city.id}&status=VERIFIED`} className="hover:text-primary">{city.verified}</Link>
              </Td>
              <Td>
                <Link href={`/admin/schools?city=${city.id}&status=PARTNER`} className="font-semibold text-green-700 hover:text-primary">{city.partner}</Link>
              </Td>
              <Td className="text-muted-foreground">{city.inactive}</Td>
              <Td>{city.contacted}</Td>
              <Td>{city.invited}</Td>
              <Td>
                <Link href={`/admin/import?city=${city.id}`} className="text-primary text-xs font-medium hover:underline whitespace-nowrap">
                  {t('admin.cities.importFor')}
                </Link>
              </Td>
            </tr>
          ))}
          {cities.length > 0 && (
            <tr className="bg-cream font-semibold">
              <Td>{t('common.total')}</Td>
              <Td>
                <StatusBadge status="IN_PROGRESS" label={`${cities.filter((c) => c.researchStatus === 'DONE').length}/${cities.length} ${t('enums.researchStatus.DONE')}`} />
              </Td>
              <Td>{totals.total}</Td>
              <Td>{totals.verified}</Td>
              <Td>{totals.partner}</Td>
              <Td />
              <Td>{totals.contacted}</Td>
              <Td />
              <Td />
            </tr>
          )}
        </Table>
      </Card>

      <Card title={t('admin.cities.addCity')} className="max-w-xl">
        <ActionForm action={createCityAction} submitLabel={t('admin.cities.addCity')} successMessage={t('common.saved')} resetOnSuccess className="grid sm:grid-cols-[1fr_8rem_auto] gap-3 items-end space-y-0">
          <Field label={t('admin.cities.city')}>
            <input name="name" required className={inputClass} placeholder="Gelsenkirchen" />
          </Field>
          <Field label={t('admin.cities.priority')}>
            <input name="priority" type="number" min={0} defaultValue={100} className={inputClass} />
          </Field>
        </ActionForm>
      </Card>
    </div>
  )
}
