import { DEFAULT_CURRENCY } from './config'
import { intlLocale } from './i18n/core'

export function formatMoney(cents: number, currency = DEFAULT_CURRENCY, locale = 'de') {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100)
}

/** Parses user input such as "199", "199.50" or "199,50" into integer cents. */
export function parseMoneyToCents(input: string | number): number {
  if (typeof input === 'number') return Math.round(input * 100)
  const normalized = input.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const value = Number(normalized)
  if (!Number.isFinite(value)) throw new Error(`Invalid amount: ${input}`)
  return Math.round(value * 100)
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2)
}
