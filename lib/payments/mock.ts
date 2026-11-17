import { randomUUID } from 'node:crypto'
import type { CheckoutSession, CreateCheckoutInput, PaymentEvent, PaymentProvider, RefundResult } from './types'

/**
 * Development/test provider. Checkout sends the student to a local page that
 * simulates the provider; refunds always succeed unless `failRefunds` is set.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock'
  sessions = new Map<string, CreateCheckoutInput & { status: 'open' | 'expired' | 'complete' }>()
  refunds: { id: string; paymentId: string; amountCents: number; idempotencyKey: string }[] = []
  failRefunds = false

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const existing = [...this.sessions.entries()].find(([, s]) => s.holdId === input.holdId && s.status === 'open')
    const id = existing?.[0] ?? `mock_cs_${input.holdId}`
    this.sessions.set(id, { ...input, status: 'open' })
    return { id, url: `/checkout/mock?session=${encodeURIComponent(id)}&booking=${encodeURIComponent(input.bookingId)}` }
  }

  async expireCheckout(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (session && session.status === 'open') session.status = 'expired'
  }

  async refund(input: { paymentId: string; amountCents: number; idempotencyKey: string }): Promise<RefundResult> {
    if (this.failRefunds) return { id: `mock_re_failed_${randomUUID()}`, status: 'FAILED' }
    const existing = this.refunds.find((r) => r.idempotencyKey === input.idempotencyKey)
    if (existing) return { id: existing.id, status: 'SUCCEEDED' }
    const refund = { id: `mock_re_${randomUUID()}`, ...input }
    this.refunds.push(refund)
    return { id: refund.id, status: 'SUCCEEDED' }
  }

  async parseWebhook(rawBody: string): Promise<PaymentEvent> {
    return JSON.parse(rawBody) as PaymentEvent
  }
}
