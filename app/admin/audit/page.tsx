import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { AuditList } from '@/components/app/audit-list'
import { buttonClass, Card, inputClass, PageHeader, Pager } from '@/components/app/ui'

export const metadata = { title: 'Audit log | Admin' }

const PAGE_SIZE = 50
const ENTITIES = ['School', 'Intake', 'CourseType', 'Booking', 'Payment', 'Refund', 'CommissionTerms', 'Subscription', 'ProfileClaim', 'SchoolMembership', 'Branch']

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const { t, locale } = await getT()
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Prisma.AuditEventWhereInput = {}
  if (params.entity && ENTITIES.includes(params.entity)) where.entity = params.entity
  if (params.action?.trim()) where.action = { contains: params.action.trim() }
  if (params.school) where.schoolId = params.school
  if (params.id?.trim()) where.entityId = params.id.trim()
  if (params.from) where.createdAt = { gte: new Date(`${params.from}T00:00:00Z`) }

  const [events, total, schools] = await Promise.all([
    prisma.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { actor: { select: { name: true } } } }),
    prisma.auditEvent.count({ where }),
    prisma.school.findMany({ where: { auditEvents: { some: {} } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const href = (p: number) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') qs.set(k, v)
    qs.set('page', String(p))
    return `/admin/audit?${qs}`
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.audit.title')} description={t('admin.audit.subtitle')} />
      <form method="get" className="bg-white rounded-lg shadow-soft p-4 grid gap-3 md:grid-cols-6">
        <select name="entity" defaultValue={params.entity ?? ''} className={inputClass}>
          <option value="">{t('admin.audit.allEntities')}</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <input name="action" defaultValue={params.action} placeholder={t('admin.audit.actionContains')} className={inputClass} />
        <select name="school" defaultValue={params.school ?? ''} className={inputClass}>
          <option value="">{t('admin.bookings.allSchools')}</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input name="id" defaultValue={params.id} placeholder="ID" className={inputClass} />
        <input type="date" name="from" defaultValue={params.from} className={inputClass} />
        <button className={buttonClass}>{t('common.filter')}</button>
      </form>
      <Card>
        <p className="text-sm text-muted-foreground mb-3">{t('common.showing', { count: total })}</p>
        <AuditList events={events} t={t} locale={locale} showEntity />
        <Pager page={page} pageCount={pageCount} href={href} label={t('common.page', { page, pages: pageCount })} />
      </Card>
    </div>
  )
}
