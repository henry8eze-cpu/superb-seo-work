import Link from 'next/link'
import { getActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { findInvitation } from '@/lib/services/onboarding'
import { acceptInvitationAction } from '@/app/actions/school'
import { ActionButton } from '@/components/app/action-form'
import { buttonClass, Card } from '@/components/app/ui'

export const metadata = { title: 'Invitation' }

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { t } = await getT()
  const [invitation, actor] = await Promise.all([findInvitation(token, 'STAFF'), getActor()])
  const callback = encodeURIComponent(`/invite/${token}`)

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        {!invitation ? (
          <p className="text-sm">{t('errors.INVITATION_INVALID')}</p>
        ) : (
          <div className="space-y-4">
            <h1 className="font-poppins text-2xl font-bold">{t('school.invite.title', { school: invitation.school.name })}</h1>
            <p className="text-sm text-muted-foreground">{t('school.invite.body', { school: invitation.school.name })}</p>
            {!actor ? (
              <>
                <p className="text-sm">{t('school.invite.loginFirst', { email: invitation.email })}</p>
                <div className="flex gap-2">
                  <Link href={`/auth/login?callbackUrl=${callback}`} className={buttonClass}>
                    {t('common.login')}
                  </Link>
                  <Link href={`/auth/signup?callbackUrl=${callback}`} className="px-4 py-2 text-sm font-medium text-primary">
                    {t('common.signup')}
                  </Link>
                </div>
              </>
            ) : actor.email.toLowerCase() !== invitation.email.toLowerCase() ? (
              <p className="text-sm text-red-700">{t('school.invite.wrongAccount', { email: actor.email, invited: invitation.email })}</p>
            ) : (
              <ActionButton action={acceptInvitationAction.bind(null, token)} variant="primary" redirectTo="/school">
                {t('school.invite.accept')}
              </ActionButton>
            )}
          </div>
        )}
      </Card>
    </main>
  )
}
