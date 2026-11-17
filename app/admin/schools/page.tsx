import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { formatDate } from '@/lib/dates'
import { buttonClass, Card, inputClass, PageHeader, Pager, secondaryButtonClass, StatusBadge, Table, Td } from '@/components/app/ui'

export const metadata = { title: 'Schools | Admin' }

const PAGE_SIZE = 25
const STATUSES = ['DISCOVERED', 'VERIFIED', 'PARTNER', 'INACTIVE'] as const
const STAGES = ['NOT_CONTACTED', 'CONTACTED', 'INVITED', 'CLAIM_PENDING', 'ONBOARDED', 'DECLINED'] as const

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; city?: string; status?: string; stage?: string; page?: string }>
}) {
  await requireAdmin()
  const { t, locale } = await getT()
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Prisma.SchoolWhereInput = { mergedIntoId: null }
  if (params.search?.trim()) {
    const q = params.search.trim()
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { website: { contains: q, mode: 'insensitive' } },
      { publicEmail: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
    ]
  }
  if (params.city) where.cityId = params.city
  if (STATUSES.includes(params.status as (typeof STATUSES)[number])) where.status = params.status as (typeof STATUSES)[number]
  if (STAGES.includes(params.stage as (typeof STAGES)[number])) where.onboardingStage = params.stage as (typeof STAGES)[number]

  const [schools, total, cities] = await Promise.all([
    prisma.school.findMany({
      where,
      include: { city: true, _count: { select: { sources: true, courseTypes: true } } },
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.school.count({ where }),
    prisma.city.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] }),
  ])
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const href = (p: number) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') qs.set(k, v)
    qs.set('page', String(p))
    return `/admin/schools?${qs}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.schools.title')}
        description={t('admin.schools.subtitle')}
        actions={
          <>
            <Link href="/admin/import" className={secondaryButtonClass}>
              {t('admin.nav.import')}
            </Link>
            <Link href="/admin/schools/new" className={buttonClass}>
              {t('admin.schools.new')}
            </Link>
          </>
        }
      />

      <form method="get" className="bg-white rounded-lg shadow-soft p-4 grid gap-3 md:grid-cols-[1fr_repeat(3,minmax(0,12rem))_auto]">
        <input name="search" defaultValue={params.search} placeholder={t('admin.schools.searchPlaceholder')} className={inputClass} />
        <select name="city" defaultValue={params.city ?? ''} className={inputClass}>
          <option value="">{t('admin.schools.allCities')}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ''} className={inputClass}>
          <option value="">{t('admin.schools.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`enums.schoolStatus.${s}`)}
            </option>
          ))}
        </select>
        <select name="stage" defaultValue={params.stage ?? ''} className={inputClass}>
          <option value="">{t('admin.schools.allStages')}</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {t(`enums.onboardingStage.${s}`)}
            </option>
          ))}
        </select>
        <button className={buttonClass}>{t('common.filter')}</button>
      </form>

      <Card>
        <p className="text-sm text-muted-foreground mb-3">{t('common.showing', { count: total })}</p>
        <Table head={[t('common.name'), t('common.city'), t('common.status'), t('admin.schools.stage'), t('admin.school.sources'), t('admin.schools.lastChecked')]} empty={t('common.noResults')}>
          {schools.map((school) => (
            <tr key={school.id} className="hover:bg-cream">
              <Td>
                <Link href={`/admin/schools/${school.id}`} className="font-medium hover:text-primary">
                  {school.name}
                </Link>
                {school.website && <p className="text-xs text-muted-foreground truncate max-w-xs">{school.websiteDomain}</p>}
              </Td>
              <Td>{school.city?.name ?? '–'}</Td>
              <Td>
                <StatusBadge status={school.status} label={t(`enums.schoolStatus.${school.status}`)} />
              </Td>
              <Td>
                <StatusBadge status={school.onboardingStage} label={t(`enums.onboardingStage.${school.onboardingStage}`)} />
              </Td>
              <Td className={school._count.sources === 0 ? 'text-red-600 font-semibold' : ''}>{school._count.sources}</Td>
              <Td className="text-muted-foreground whitespace-nowrap">{school.lastCheckedAt ? formatDate(school.lastCheckedAt, locale) : t('admin.schools.never')}</Td>
            </tr>
          ))}
        </Table>
        <Pager page={page} pageCount={pageCount} href={href} label={t('common.page', { page, pages: pageCount })} />
      </Card>
    </div>
  )
}
