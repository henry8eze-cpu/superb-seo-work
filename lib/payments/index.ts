import { MockPaymentProvider } from './mock'
import { StripePaymentProvider } from './stripe'
import type { PaymentProvider } from './types'

export type { PaymentProvider, PaymentEvent } from './types'

let provider: PaymentProvider | null = null

/** The mock provider is only allowed outside production unless ALLOW_MOCK_PAYMENTS=true is set explicitly. */
export function mockPaymentsAllowed() {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_MOCK_PAYMENTS === 'true'
}

/** PAYMENTS_PROVIDER=stripe|mock. Defaults to Stripe when STRIPE_SECRET_KEY is set. */
export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider
  const configured = process.env.PAYMENTS_PROVIDER
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (configured !== 'mock' && secretKey) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET must be set when Stripe is enabled')
    provider = new StripePaymentProvider(secretKey, webhookSecret)
  } else {
    if (!mockPaymentsAllowed()) {
      throw new Error('No payment provider configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.')
    }
    provider = new MockPaymentProvider()
  }
  return provider
}

/** For tests. */
export function setPaymentProvider(next: PaymentProvider | null) {
  provider = next
}
