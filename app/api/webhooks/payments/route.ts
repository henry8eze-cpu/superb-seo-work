import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getPaymentProvider } from '@/lib/payments'
import { handlePaymentEvent } from '@/lib/booking/inventory'
import { invalidatePublicCatalog } from '@/lib/public-cache'

// Stripe webhook endpoint. Configure in the Stripe dashboard with the events
// checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.async_payment_failed and checkout.session.expired.
export async function POST(request: Request) {
  let provider
  try {
    provider = getPaymentProvider()
  } catch {
    return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 })
  }
  if (provider.name === 'mock') return NextResponse.json({ error: 'Webhooks are disabled for the mock provider' }, { status: 404 })

  const rawBody = await request.text()
  let event
  try {
    event = await provider.parseWebhook(rawBody, request.headers.get('stripe-signature'))
  } catch (error) {
    console.error('[webhook] rejected', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    const result = await handlePaymentEvent(event)
    if (result.status !== 'duplicate' && result.status !== 'ignored') {
      revalidatePath('/courses', 'layout')
      revalidatePath('/school', 'layout')
      invalidatePublicCatalog()
    }
    return NextResponse.json({ received: true, result: result.status })
  } catch (error) {
    // A 5xx makes the provider retry; processing is idempotent, so that is safe.
    console.error('[webhook] processing failed', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
