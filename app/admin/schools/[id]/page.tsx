import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { formatDate, formatDateTime, toDayInput } from '@/lib/dates'
import { formatMoney, centsToInput } from '@/lib/money'
import { activeTerms } from '@/lib/booking/rules'
import {
  addBranchAction,
  addContactAttemptAction,
  addSourceAction,
  addStaffContactAction,
  deactivateSchoolAction,
  deleteSourceAction,
  deleteStaffContactAction,
  inviteSchoolAction,
  markCheckedAction,
  openSchoolWorkspaceAction,
  reactivateSchoolAction,
  revokeInvitationAction,
  setCommissionAction,
  setSubscriptionAction,
  updateSchoolAction,
  verifySchoolAction,
} from '@/app/actions/admin-marketplace'
import { ActionButton, ActionForm } from '@/components/app/action-form'
import { AuditList } from '@/components/app/audit-list'
import { Badge, Card, DefinitionList, Field, inputClass, PageHeader, secondaryButtonClass, StatusBadge } from '@/components/app/ui'
import { SchoolFields, SourceTypeOptions } from '@/components/admin/school-fields'

export const metadata = { title: 'School | Admin' }

const CHANNELS = ['EMAIL', 'PHONE', 'VISIT', 'CONTACT_FORM', 'OTHER'] as const
const OUTCOMES = ['NO_RESPONSE', 'INTERESTED', 'NOT_INTERESTED', 'CALL_BACK', 'INVITED', 'WRONG_CONTACT', 'OTHER'] as const

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const { t, locale } = await getT()

  const [school, cities, languages, audit] = await Promise.all([
    prisma.school.findUnique({
      where: { id },
      include: {
        city: true,
        mergedInto: { select: { id: true, name: true } },
        verifiedBy: { select: { name: true } },
        sources: { orderBy: { retrievedAt: 'desc' }, include: { createdBy: { select: { name: true } } } },
        branches: { orderBy: { createdAt: 'asc' } },
        contactAttempts: { orderBy: { contactedAt: 'desc' }, include: { user: { select: { name: true } } } },
        staffContacts: { orderBy: { createdAt: 'asc' } },
        invitations: { orderBy: { createdAt: 'desc' }, take: 10 },
        claims: { orderBy: { createdAt: 'desc' } },
        memberships: { where: { status: 'ACTIVE' }, include: { user: { select: { name: true, email: true } } } },
        courseTypes: { orderBy: { createdAt: 'desc' }, include: { _count: { select: { intakes: true } } } },
        commissionTerms: { orderBy: { validFrom: 'desc' } },
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        duplicateOf: { where: { status: 'OPEN' }, include: { otherSchool: { select: { id: true, name: true } } } },
        duplicateTargets: { where: { status: 'OPEN' }, include: { school: { select: { id: true, name: true } } } },
      },
    }),
    prisma.city.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] }),
    prisma.language.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.auditEvent.findMany({ where: { schoolId: id }, orderBy: { createdAt: 'desc' }, take: 25, include: { actor: { select: { name: true } } } }),
  ])
  if (!school) notFound()

  const currentTerms = activeTerms(school.commissionTerms)
  const subscription = school.subscriptions[0]
  const duplicates = [
    ...school.duplicateOf.map((d) => ({ id: d.id, other: d.otherSchool, score: d.score })),
    ...school.duplicateTargets.map((d) => ({ id: d.id, other: d.school, score: d.score })),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/admin/schools', label: t('admin.schools.title') }}
        title={school.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={school.status} label={t(`enums.schoolStatus.${school.status}`)} />
            <StatusBadge status={school.onboardingStage} label={t(`enums.onboardingStage.${school.onboardingStage}`)} />
            {school.status === 'PARTNER' && (
              <Badge tone={school.instantBookingEnabled ? 'green' : 'gray'}>
                {school.instantBookingEnabled ? t('admin.school.instantOn') : t('admin.school.instantOff')}
              </Badge>
            )}
            <span>
              {t('admin.schools.lastChecked')}: {school.lastCheckedAt ? formatDate(school.lastCheckedAt, locale) : t('admin.schools.never')}
            </span>
            {school.mergedInto && (
              <span>
                {t('admin.school.mergedInto')}{' '}
                <Link className="text-primary underline" href={`/admin/schools/${school.mergedInto.id}`}>
                  {school.mergedInto.name}
                </Link>
              </span>
            )}
          </span>
        }
        actions={
          <>
            <ActionButton action={markCheckedAction.bind(null, school.id)} successMessage={t('common.saved')}>
              {t('admin.school.markChecked')}
            </ActionButton>
            <form action={openSchoolWorkspaceAction.bind(null, school.id)}>
              <button className={secondaryButtonClass} title={t('admin.school.openWorkspaceHint')}>
                {t('admin.school.openWorkspace')}
              </button>
            </form>
          </>
        }
      />

      <div className="grid xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">
          {/* Status */}
          <Card title={t('common.status')}>
            <div className="grid md:grid-cols-2 gap-6">
              {(school.status === 'DISCOVERED' || (school.status === 'INACTIVE' && !school.mergedIntoId && !school.verifiedAt)) && (
                <ActionForm action={verifySchoolAction.bind(null, school.id)} submitLabel={t('admin.school.verify')} successMessage={t('admin.school.verified')}>
                  <p className="text-sm text-muted-foreground">{t('admin.school.verifyHint')}</p>
                  <Field label={t('admin.schools.legalName')}>
                    <input name="legalName" defaultValue={school.legalName ?? ''} className={inputClass} />
                  </Field>
                </ActionForm>
              )}
              {school.status !== 'INACTIVE' ? (
                <ActionForm
                  action={deactivateSchoolAction.bind(null, school.id)}
                  submitLabel={t('admin.school.deactivate')}
                  variant="danger"
                  confirmMessage={t('common.areYouSure')}
                  successMessage={t('common.saved')}
                >
                  <p className="text-sm text-muted-foreground">{t('admin.school.deactivateHint')}</p>
                  <Field label={t('common.reason')}>
                    <input name="reason" required className={inputClass} />
                  </Field>
                </ActionForm>
              ) : (
                !school.mergedIntoId && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{school.inactiveReason}</p>
                    <ActionButton action={reactivateSchoolAction.bind(null, school.id)} successMessage={t('common.saved')}>
                      {t('admin.school.reactivate')}
                    </ActionButton>
                  </div>
                )
              )}
            </div>
            {school.verifiedAt && (
              <p className="text-xs text-muted-foreground mt-4">
                {t('enums.schoolStatus.VERIFIED')}: {formatDate(school.verifiedAt, locale)} {school.verifiedBy ? `· ${school.verifiedBy.name}` : ''}
                {school.partnerSince && ` · ${t('enums.schoolStatus.PARTNER')}: ${formatDate(school.partnerSince, locale)}`}
              </p>
            )}
          </Card>

          {/* Details */}
          <Card title={t('admin.school.details')}>
            <ActionForm action={updateSchoolAction.bind(null, school.id)} submitLabel={t('common.save')} successMessage={t('common.saved')}>
              <SchoolFields t={t} cities={cities} languages={languages} school={school} />
            </ActionForm>
          </Card>

          {/* Sources */}
          <Card title={t('admin.school.sources')}>
            <ul className="divide-y divide-border mb-4">
              {school.sources.map((source) => (
                <li key={source.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p>
                      <Badge>{t(`enums.sourceType.${source.sourceType}`)}</Badge> {source.field && <span className="text-muted-foreground">({source.field})</span>}
                    </p>
                    {source.url && (
                      <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline break-all">
                        {source.url}
                      </a>
                    )}
                    {source.notes && <p className="text-muted-foreground">{source.notes}</p>}
                    <p className="text-xs text-muted-foreground">
                      {t('admin.school.retrievedAt')} {formatDate(source.retrievedAt, locale)} {source.createdBy && `· ${source.createdBy.name}`}
                    </p>
                  </div>
                  <ActionButton action={deleteSourceAction.bind(null, school.id, source.id)} variant="danger" confirmMessage={t('common.areYouSure')} className="px-2 py-1 text-xs">
                    {t('common.delete')}
                  </ActionButton>
                </li>
              ))}
            </ul>
            <ActionForm action={addSourceAction.bind(null, school.id)} submitLabel={t('admin.school.addSource')} resetOnSuccess className="grid md:grid-cols-2 gap-3 space-y-0 items-end" successMessage={t('common.saved')}>
              <Field label={t('admin.schools.sourceUrl')} hint={t('admin.schools.sourceUrlHint')} className="md:col-span-2">
                <input name="url" className={inputClass} placeholder="https://" />
              </Field>
              <Field label={t('common.status')}>
                <select name="sourceType" className={inputClass}>
                  <SourceTypeOptions t={t} />
                </select>
              </Field>
              <Field label={t('admin.school.sourceField')}>
                <input name="field" className={inputClass} placeholder="phone, address, courses…" />
              </Field>
              <Field label={t('admin.school.retrievedAt')}>
                <input name="retrievedAt" type="date" defaultValue={toDayInput(new Date())} className={inputClass} />
              </Field>
              <Field label={t('common.notes')}>
                <input name="notes" className={inputClass} />
              </Field>
            </ActionForm>
          </Card>

          {/* Branches */}
          <Card title={t('admin.school.branches')}>
            <ul className="divide-y divide-border mb-4 text-sm">
              {school.branches.map((branch) => (
                <li key={branch.id} className="py-2">
                  <span className="font-medium">{branch.name}</span>{' '}
                  <span className="text-muted-foreground">
                    {branch.isOnline ? t('common.online') : [branch.address, branch.postcode, branch.cityName].filter(Boolean).join(', ')}
                  </span>
                  {branch.archivedAt && <Badge className="ml-2">{t('enums.publication.ARCHIVED')}</Badge>}
                </li>
              ))}
            </ul>
            <ActionForm action={addBranchAction.bind(null, school.id)} submitLabel={t('admin.school.addBranch')} resetOnSuccess className="grid md:grid-cols-2 gap-3 space-y-0 items-end" successMessage={t('common.saved')}>
              <Field label={t('common.name')}>
                <input name="name" required className={inputClass} />
              </Field>
              <Field label={t('common.address')}>
                <input name="address" className={inputClass} />
              </Field>
              <Field label={t('common.postcode')}>
                <input name="postcode" className={inputClass} />
              </Field>
              <Field label={t('common.city')}>
                <input name="cityName" defaultValue={school.city?.name} className={inputClass} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isOnline" /> {t('admin.school.isOnline')}
              </label>
            </ActionForm>
          </Card>

          {/* Contact log */}
          <Card title={t('admin.school.contactLog')}>
            <ul className="divide-y divide-border mb-4 text-sm">
              {school.contactAttempts.map((attempt) => (
                <li key={attempt.id} className="py-2">
                  <p>
                    <Badge>{t(`enums.contactChannel.${attempt.channel}`)}</Badge> <Badge tone="blue">{t(`enums.contactOutcome.${attempt.outcome}`)}</Badge>{' '}
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(attempt.contactedAt, locale)} · {attempt.user.name}
                    </span>
                  </p>
                  {attempt.notes && <p className="mt-1 whitespace-pre-wrap">{attempt.notes}</p>}
                  {attempt.nextStep && (
                    <p className="text-xs text-primary mt-1">
                      → {attempt.nextStep} {attempt.nextStepDate && `(${formatDate(attempt.nextStepDate, locale)})`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <ActionForm action={addContactAttemptAction.bind(null, school.id)} submitLabel={t('admin.school.logContact')} resetOnSuccess className="grid md:grid-cols-2 gap-3 space-y-0 items-end" successMessage={t('common.saved')}>
              <Field label={t('admin.school.channel')}>
                <select name="channel" className={inputClass}>
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {t(`enums.contactChannel.${c}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('admin.school.outcome')}>
                <select name="outcome" className={inputClass}>
                  {OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      {t(`enums.contactOutcome.${o}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('common.notes')} className="md:col-span-2">
                <textarea name="notes" rows={2} className={inputClass} />
              </Field>
              <Field label={t('admin.school.nextStep')}>
                <input name="nextStep" className={inputClass} />
              </Field>
              <Field label={t('admin.school.nextStepDate')}>
                <input name="nextStepDate" type="date" className={inputClass} />
              </Field>
            </ActionForm>
          </Card>

          <Card title={t('admin.school.history')}>
            <AuditList events={audit} t={t} locale={locale} showEntity />
          </Card>
        </div>

        <div className="space-y-6">
          {/* Invitation */}
          <Card title={t('admin.school.invite')}>
            {school.status === 'VERIFIED' ? (
              <ActionForm action={inviteSchoolAction.bind(null, school.id)} submitLabel={t('admin.school.invite')} successMessage={t('admin.school.inviteSent')}>
                <p className="text-xs text-muted-foreground">{t('admin.school.inviteHint')}</p>
                <Field label={t('common.email')}>
                  <input name="email" type="email" required defaultValue={school.publicEmail ?? ''} className={inputClass} />
                </Field>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted-foreground">{t('admin.school.inviteHint')}</p>
            )}
            {school.invitations.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm">
                {school.invitations.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate">{inv.email}</span>
                      <span className="text-xs text-muted-foreground">
                        {inv.kind} ·{' '}
                        {inv.acceptedAt
                          ? t('admin.school.accepted')
                          : inv.revokedAt
                            ? t('admin.school.revoked')
                            : t('admin.school.expires', { date: formatDate(inv.expiresAt, locale) })}
                      </span>
                    </span>
                    {!inv.acceptedAt && !inv.revokedAt && (
                      <ActionButton action={revokeInvitationAction.bind(null, school.id, inv.id)} className="px-2 py-1 text-xs">
                        {t('admin.school.revoke')}
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {school.claims.length > 0 && (
            <Card title={t('admin.school.claims')}>
              <ul className="space-y-2 text-sm">
                {school.claims.map((claim) => (
                  <li key={claim.id}>
                    <Link href={`/admin/claims/${claim.id}`} className="flex items-center justify-between hover:text-primary">
                      <span>{claim.claimantName}</span>
                      <StatusBadge status={claim.status} label={t(`enums.claimStatus.${claim.status}`)} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {duplicates.length > 0 && (
            <Card title={t('admin.school.duplicates')}>
              <ul className="space-y-2 text-sm">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <Link href={`/admin/duplicates/${d.id}`} className="flex justify-between hover:text-primary">
                      <span>{d.other.name}</span>
                      <span className="text-muted-foreground">{d.score}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Staff contacts */}
          <Card title={t('admin.school.staffContacts')}>
            <ul className="space-y-2 text-sm mb-4">
              {school.staffContacts.map((contact) => (
                <li key={contact.id} className="flex justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-medium">{contact.name}</span> {contact.position && <span className="text-muted-foreground">· {contact.position}</span>}
                    <span className="block text-xs text-muted-foreground break-all">{[contact.email, contact.phone].filter(Boolean).join(' · ')}</span>
                  </span>
                  <ActionButton action={deleteStaffContactAction.bind(null, school.id, contact.id)} variant="danger" confirmMessage={t('common.areYouSure')} className="px-2 py-1 text-xs">
                    ×
                  </ActionButton>
                </li>
              ))}
            </ul>
            <ActionForm action={addStaffContactAction.bind(null, school.id)} submitLabel={t('admin.school.addContact')} resetOnSuccess className="space-y-3">
              <input name="name" required placeholder={t('common.name')} className={inputClass} />
              <input name="position" placeholder={t('admin.school.position')} className={inputClass} />
              <input name="email" type="email" placeholder={t('common.email')} className={inputClass} />
              <input name="phone" placeholder={t('common.phone')} className={inputClass} />
            </ActionForm>
          </Card>

          {/* Team & courses */}
          {(school.memberships.length > 0 || school.courseTypes.length > 0) && (
            <Card title={t('admin.school.members')}>
              <ul className="space-y-1 text-sm mb-4">
                {school.memberships.map((m) => (
                  <li key={m.id}>
                    {m.user.name} <span className="text-muted-foreground">· {t(`enums.membershipRole.${m.role}`)} · {m.user.email}</span>
                  </li>
                ))}
              </ul>
              <h4 className="font-semibold text-sm mb-2">{t('admin.school.courses')}</h4>
              <ul className="space-y-1 text-sm">
                {school.courseTypes.map((ct) => (
                  <li key={ct.id} className="flex justify-between gap-2">
                    <span>{ct.name}</span>
                    <StatusBadge status={ct.publicationStatus} label={t(`enums.publication.${ct.publicationStatus}`)} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Commission */}
          <Card title={t('admin.school.commission')}>
            <p className="text-xs text-muted-foreground mb-3">{t('admin.school.commissionHint')}</p>
            <p className="text-sm font-medium mb-3">
              {currentTerms
                ? currentTerms.type === 'FIXED'
                  ? formatMoney(currentTerms.fixedCents ?? 0, 'EUR', locale)
                  : `${((currentTerms.percentBps ?? 0) / 100).toFixed(2)} %`
                : t('admin.school.noCommission')}
            </p>
            <ActionForm action={setCommissionAction.bind(null, school.id)} submitLabel={t('admin.school.setCommission')} successMessage={t('common.saved')} className="space-y-3">
              <select name="type" defaultValue={currentTerms?.type ?? 'FIXED'} className={inputClass}>
                <option value="FIXED">{t('enums.commissionType.FIXED')}</option>
                <option value="PERCENT">{t('enums.commissionType.PERCENT')}</option>
              </select>
              <Field label={t('admin.school.fixedAmount')}>
                <input name="fixed" inputMode="decimal" defaultValue={currentTerms?.fixedCents ? centsToInput(currentTerms.fixedCents) : ''} className={inputClass} />
              </Field>
              <Field label={t('admin.school.percent')}>
                <input name="percent" inputMode="decimal" defaultValue={currentTerms?.percentBps ? currentTerms.percentBps / 100 : ''} className={inputClass} />
              </Field>
              <Field label={t('admin.school.validFrom')}>
                <input name="validFrom" type="date" className={inputClass} />
              </Field>
              <input name="note" placeholder={t('common.notes')} className={inputClass} />
            </ActionForm>
            {school.commissionTerms.length > 1 && (
              <ul className="mt-3 text-xs text-muted-foreground space-y-1">
                {school.commissionTerms.map((terms) => (
                  <li key={terms.id}>
                    {formatDate(terms.validFrom, locale)}–{terms.validTo ? formatDate(terms.validTo, locale) : '…'}:{' '}
                    {terms.type === 'FIXED' ? formatMoney(terms.fixedCents ?? 0, 'EUR', locale) : `${(terms.percentBps ?? 0) / 100} %`}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Subscription */}
          <Card title={t('admin.school.subscription')}>
            {subscription && (
              <DefinitionList
                items={[
                  [t('common.status'), t(`enums.subscriptionStatus.${subscription.status}`)],
                  [t('admin.school.monthlyPrice'), formatMoney(subscription.monthlyPriceCents, subscription.currency, locale)],
                ]}
              />
            )}
            <ActionForm action={setSubscriptionAction.bind(null, school.id)} submitLabel={t('admin.school.setSubscription')} successMessage={t('common.saved')} className="space-y-3 mt-3">
              <Field label={t('admin.school.monthlyPrice')}>
                <input name="monthlyPrice" inputMode="decimal" required defaultValue={subscription ? centsToInput(subscription.monthlyPriceCents) : ''} className={inputClass} />
              </Field>
              <select name="status" defaultValue={subscription?.status ?? 'NONE'} className={inputClass}>
                {(['NONE', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`enums.subscriptionStatus.${s}`)}
                  </option>
                ))}
              </select>
              <Field label={t('admin.school.startedAt')}>
                <input name="startedAt" type="date" defaultValue={toDayInput(subscription?.startedAt)} className={inputClass} />
              </Field>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  )
}
