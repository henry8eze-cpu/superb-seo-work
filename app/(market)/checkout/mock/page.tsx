import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatMoney } from '@/lib/money'
import { getPaymentProvider, mockPaymentsAllowed } from '@/lib/payments'
import { completeMockPaymentAction } from '@/app/actions/marketplace'
import { ActionButton } from '@/components/app/action-form'
import { Card } from '@/components/app/ui'

export const metadata = { title: 'Test payment' }

// Stands in for the payment provider's hosted page during development. Never available in production.
export default async function MockCheckoutPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  if (!mockPaymentsAllowed() || getPaymentProvider().name !== 'mock') notFound()
  const { booking: bookingId } = await searchParams
  const actor = await requireActor()
  const { t, locale } = await getT()
  const booking = bookingId ? await prisma.booking.findUnique({ where: { id: bookingId } }) : null
  if (!booking || booking.studentUserId !== actor.userId) notFound()

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Card className="space-y-4 border-2 border-dashed border-secondary">
        <h1 className="font-poppins text-xl font-bold">{t('market.checkout.mockTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('market.checkout.mockBody')}</p>
        <p className="text-2xl font-bold">{formatMoney(booking.totalCents, booking.currency, locale)}</p>
        <ActionButton action={completeMockPaymentAction.bind(null, booking.id, 'paid')} variant="primary" className="w-full">
          {t('market.checkout.mockPay')}
        </ActionButton>
        <ActionButton action={completeMockPaymentAction.bind(null, booking.id, 'cancel')} className="w-full">
          {t('market.checkout.mockCancel')}
        </ActionButton>
      </Card>
    </div>
  )
}
