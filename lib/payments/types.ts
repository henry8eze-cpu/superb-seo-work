// Payment provider abstraction. Stripe in production; a mock for development and tests.

export type CreateCheckoutInput = {
  bookingId: string
  holdId: string
  amountCents: number
  currency: string
  description: string
  customerEmail: string
  successUrl: string
  cancelUrl: string
  expiresAt: Date
  locale: string
}

export type CheckoutSession = { id: string; url: string }

export type RefundResult = { id: string; status: 'SUCCEEDED' | 'PENDING' | 'FAILED' }

/** Provider events, reduced to what the booking system needs. */
export type PaymentEvent =
  | {
      kind: 'checkout_completed'
      eventId: string
      bookingId: string
      sessionId: string
      paymentId: string // provider payment id (Stripe PaymentIntent)
      amountCents: number
      currency: string
    }
  | { kind: 'checkout_expired'; eventId: string; bookingId: string; sessionId: string }
  | { kind: 'ignored'; eventId: string; type: string }

export interface PaymentProvider {
  readonly name: string
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>
  expireCheckout(sessionId: string): Promise<void>
  /** `idempotencyKey` must be stable per refund so retries never refund twice. */
  refund(input: { paymentId: string; amountCents: number; idempotencyKey: string }): Promise<RefundResult>
  parseWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent>
}
