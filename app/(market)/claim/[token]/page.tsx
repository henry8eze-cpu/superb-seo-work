import Link from 'next/link'
import { getActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { findInvitation } from '@/lib/services/onboarding'
import { submitClaimAction } from '@/app/actions/marketplace'
import { ActionForm } from '@/components/app/action-form'
import { buttonClass, Card, Field, inputClass } from '@/components/app/ui'

export const metadata = { title: 'Claim your school' }

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [{ t }, actor, invitation] = await Promise.all([getT(), getActor(), findInvitation(token, 'CLAIM')])
  const callback = encodeURIComponent(`/claim/${token}`)

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <Card>
        {!invitation ? (
          <p className="text-sm">{t('errors.INVITATION_INVALID')}</p>
        ) : (
          <div className="space-y-5">
            <h1 className="font-poppins text-2xl font-bold">{t('market.claim.title', { school: invitation.school.name })}</h1>
            <p className="text-sm text-muted-foreground">{t('market.claim.intro')}</p>
            {!actor ? (
              <div className="space-y-3">
                <p className="text-sm">{t('market.claim.loginFirst')}</p>
                <div className="flex gap-2">
                  <Link href={`/auth/signup?callbackUrl=${callback}`} className={buttonClass}>
                    {t('common.signup')}
                  </Link>
                  <Link href={`/auth/login?callbackUrl=${callback}`} className="px-4 py-2 text-sm font-medium text-primary">
                    {t('common.login')}
                  </Link>
                </div>
              </div>
            ) : (
              <ActionForm action={submitClaimAction.bind(null, token)} submitLabel={t('market.claim.submit')}>
                <p className="text-xs text-muted-foreground">
                  {t('common.email')}: <strong>{actor.email}</strong>
                </p>
                <Field label={t('common.name')}>
                  <input name="claimantName" required defaultValue={actor.name} className={inputClass} />
                </Field>
                <Field label={t('market.claim.position')}>
                  <input name="claimantPosition" required placeholder={t('market.claim.positionPlaceholder')} className={inputClass} />
                </Field>
                <Field label={`${t('common.phone')} (${t('common.optional')})`}>
                  <input name="claimantPhone" className={inputClass} />
                </Field>
                <Field label={`${t('common.message')} (${t('common.optional')})`}>
                  <textarea name="message" rows={3} className={inputClass} />
                </Field>
                <Field label={t('market.claim.documents')} hint={t('market.claim.documentsHint')}>
                  <input type="file" name="documents" multiple accept="application/pdf,image/png,image/jpeg" className="block text-sm" />
                </Field>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="confirmAuthority" required className="mt-1" /> {t('market.claim.confirm')}
                </label>
              </ActionForm>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
