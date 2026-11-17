import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { formatDateTime } from '@/lib/dates'
import { approveClaimAction, rejectClaimAction } from '@/app/actions/admin-marketplace'
import { ActionForm } from '@/components/app/action-form'
import { Badge, Card, DefinitionList, Field, inputClass, PageHeader, StatusBadge } from '@/components/app/ui'

export const metadata = { title: 'Claim | Admin' }

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const { t, locale } = await getT()
  const claim = await prisma.profileClaim.findUnique({
    where: { id },
    include: {
      school: { include: { city: true, sources: { take: 5, orderBy: { retrievedAt: 'desc' } } } },
      user: { select: { email: true, createdAt: true } },
      reviewedBy: { select: { name: true } },
      documents: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } },
      invitation: { select: { email: true } },
    },
  })
  if (!claim) notFound()

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        back={{ href: '/admin/claims', label: t('admin.claims.title') }}
        title={claim.school.name}
        description={<StatusBadge status={claim.status} label={t(`enums.claimStatus.${claim.status}`)} />}
      />

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Card title={t('admin.claims.claimant')}>
          <DefinitionList
            items={[
              [t('common.name'), claim.claimantName],
              [t('admin.school.position'), claim.claimantPosition],
              [t('common.email'), claim.claimantEmail],
              [t('common.phone'), claim.claimantPhone],
              ['', <Badge key="d" tone={claim.emailDomainMatches ? 'green' : 'orange'}>{claim.emailDomainMatches ? t('admin.claims.domainMatch') : t('admin.claims.domainMismatch')}</Badge>],
              [t('admin.school.invitations'), claim.invitation?.email],
              [t('common.message'), claim.message ? <span className="whitespace-pre-wrap">{claim.message}</span> : null],
              [t('common.date'), formatDateTime(claim.createdAt, locale)],
            ]}
          />
          <h4 className="font-semibold text-sm mt-6 mb-2">{t('admin.claims.documents')}</h4>
          {claim.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('admin.claims.noDocuments')}</p>
          ) : (
            <ul className="text-sm space-y-1">
              {claim.documents.map((doc) => (
                <li key={doc.id}>
                  <a href={`/api/admin/claim-documents/${doc.id}`} target="_blank" rel="noopener" className="text-primary underline">
                    {doc.fileName}
                  </a>{' '}
                  <span className="text-muted-foreground">({Math.round(doc.sizeBytes / 1024)} KB)</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('admin.bookings.school')}>
          <DefinitionList
            items={[
              [t('common.status'), t(`enums.schoolStatus.${claim.school.status}`)],
              [t('common.city'), claim.school.city?.name],
              [t('common.website'), claim.school.website],
              [t('admin.schools.publicEmail'), claim.school.publicEmail],
              [t('common.phone'), claim.school.phone],
              [t('admin.schools.legalName'), claim.school.legalName],
            ]}
          />
          <ul className="text-xs mt-3 space-y-1">
            {claim.school.sources.map((s) =>
              s.url ? (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline break-all">
                    {s.url}
                  </a>
                </li>
              ) : null
            )}
          </ul>
          <Link href={`/admin/schools/${claim.schoolId}`} className="text-sm text-primary underline mt-3 inline-block">
            {t('common.open')}
          </Link>
        </Card>
      </div>

      {claim.status === 'PENDING' ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card title={t('admin.claims.approve')}>
            <p className="text-sm text-muted-foreground mb-3">{t('admin.claims.checklist')}</p>
            <ActionForm action={approveClaimAction.bind(null, claim.id)} submitLabel={t('admin.claims.approve')} successMessage={t('admin.claims.approved')} confirmMessage={t('common.areYouSure')}>
              <Field label={t('admin.claims.note')}>
                <textarea name="note" rows={2} className={inputClass} />
              </Field>
            </ActionForm>
          </Card>
          <Card title={t('admin.claims.reject')}>
            <ActionForm action={rejectClaimAction.bind(null, claim.id)} submitLabel={t('admin.claims.reject')} variant="danger" successMessage={t('admin.claims.rejected')}>
              <Field label={t('admin.claims.rejectReason')}>
                <textarea name="note" rows={3} required className={inputClass} />
              </Field>
            </ActionForm>
          </Card>
        </div>
      ) : (
        <Card>
          <p className="text-sm">
            {t('admin.claims.reviewedBy', { name: claim.reviewedBy?.name ?? '–', date: formatDateTime(claim.reviewedAt, locale) })}
          </p>
          {claim.reviewNote && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{claim.reviewNote}</p>}
        </Card>
      )}
    </div>
  )
}
