import { CheckCircle2 } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { Card } from '@/components/app/ui'

export const metadata = { title: 'Claim submitted' }

export default async function ClaimSubmittedPage() {
  const { t } = await getT()
  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <Card className="text-center space-y-4 py-10">
        <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
        <h1 className="font-poppins text-2xl font-bold">{t('market.claim.submittedTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('market.claim.submittedBody')}</p>
      </Card>
    </div>
  )
}
