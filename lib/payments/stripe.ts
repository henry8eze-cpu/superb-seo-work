import Stripe from 'stripe'
import type { CheckoutSession, CreateCheckoutInput, PaymentEvent, PaymentProvider, RefundResult } from './types'

// Stripe requires a Checkout Session to live at least 30 minutes.
const STRIPE_MIN_SESSION_MS = 30 * 60 * 1000 + 30_000

export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe'
  private stripe: Stripe

  constructor(
    secretKey: string,
    private webhookSecret: string
  ) {
    this.stripe = new Stripe(secretKey)
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const expiresAt = Math.max(input.expiresAt.getTime(), Date.now() + STRIPE_MIN_SESSION_MS)
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: input.customerEmail,
        client_reference_id: input.bookingId,
        locale: input.locale === 'de' || input.locale === 'en' || input.locale === 'tr' ? input.locale : 'auto',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.amountCents,
              product_data: { name: input.description },
            },
          },
        ],
        metadata: { bookingId: input.bookingId, holdId: input.holdId },
        payment_intent_data: { metadata: { bookingId: input.bookingId } },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        expires_at: Math.ceil(expiresAt / 1000),
      },
      // One Checkout Session per seat hold, however often the student clicks "Pay".
      { idempotencyKey: `checkout-${input.holdId}` }
    )
    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return { id: session.id, url: session.url }
  }

  async expireCheckout(sessionId: string) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId)
      if (session.status === 'open') await this.stripe.checkout.sessions.expire(sessionId)
    } catch (error) {
      console.error('[stripe] could not expire checkout session', sessionId, error)
    }
  }

  async refund(input: { paymentId: string; amountCents: number; idempotencyKey: string }): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create(
      { payment_intent: input.paymentId, amount: input.amountCents },
      { idempotencyKey: input.idempotencyKey }
    )
    const status = refund.status === 'succeeded' ? 'SUCCEEDED' : refund.status === 'failed' || refund.status === 'canceled' ? 'FAILED' : 'PENDING'
    return { id: refund.id, status }
  }

  async parseWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent> {
    if (!signature) throw new Error('Missing Stripe signature')
    const event = await this.stripe.webhooks.constructEventAsync(rawBody, signature, this.webhookSecret)

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session
      const bookingId = session.metadata?.bookingId
      if (!bookingId || session.payment_status !== 'paid') return { kind: 'ignored', eventId: event.id, type: event.type }
      const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
      if (!paymentIntent) return { kind: 'ignored', eventId: event.id, type: event.type }
      return {
        kind: 'checkout_completed',
        eventId: event.id,
        bookingId,
        sessionId: session.id,
        paymentId: paymentIntent,
        amountCents: session.amount_total ?? 0,
        currency: (session.currency ?? 'eur').toUpperCase(),
      }
    }

    if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session
      const bookingId = session.metadata?.bookingId
      if (!bookingId) return { kind: 'ignored', eventId: event.id, type: event.type }
      return { kind: 'checkout_expired', eventId: event.id, bookingId, sessionId: session.id }
    }

    return { kind: 'ignored', eventId: event.id, type: event.type }
  }
}
