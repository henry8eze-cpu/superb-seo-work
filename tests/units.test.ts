import { describe, expect, it } from 'vitest'
import { bookingMode, commissionFor, activeTerms, totalPrice } from '@/lib/booking/rules'
import { normalizeDomain, normalizeName, normalizePhone, scoreDuplicate } from '@/lib/schools/normalize'
import { parseCsv, toCsv } from '@/lib/csv'
import { parseMoneyToCents } from '@/lib/money'
import { messages, AUTHORED_LOCALES, OVERLAYS, negotiateLocale, getTFor, messageKeys, lookup, languageName, intlLocale, type MessageTree } from '@/lib/i18n'
import { translations } from '@/lib/translations'

const future = new Date(Date.now() + 30 * 86_400_000)
const base = {
  school: { status: 'PARTNER' as const, instantBookingEnabled: true },
  courseType: { publicationStatus: 'PUBLISHED' as const },
  intake: { status: 'OPEN' as const, instantBooking: true, bookingDeadline: null, startDate: future, archivedAt: null },
  available: 3,
}

describe('booking labels', () => {
  it('only a partner with instant booking, an open intake and a free seat is “Book instantly”', () => {
    expect(bookingMode(base).mode).toBe('INSTANT')
    expect(bookingMode({ ...base, school: { status: 'VERIFIED', instantBookingEnabled: false } }).mode).toBe('ENQUIRY')
    expect(bookingMode({ ...base, school: { status: 'PARTNER', instantBookingEnabled: false } }).mode).toBe('ENQUIRY')
    expect(bookingMode({ ...base, intake: { ...base.intake, instantBooking: false } }).mode).toBe('ENQUIRY')
    expect(bookingMode({ ...base, available: 0 })).toEqual({ mode: 'UNAVAILABLE', reason: 'FULL' })
    expect(bookingMode({ ...base, intake: { ...base.intake, status: 'PAUSED' } })).toEqual({ mode: 'UNAVAILABLE', reason: 'PAUSED' })
    expect(bookingMode({ ...base, intake: { ...base.intake, status: 'CLOSED' } })).toEqual({ mode: 'UNAVAILABLE', reason: 'CLOSED' })
    expect(bookingMode({ ...base, intake: { ...base.intake, bookingDeadline: new Date(Date.now() - 1000) } }).reason).toBe('DEADLINE_PASSED')
    expect(bookingMode({ ...base, school: { status: 'DISCOVERED', instantBookingEnabled: false } }).mode).toBe('UNAVAILABLE')
  })

  it('computes total price and commission without hard-coded amounts', () => {
    expect(totalPrice(40_000, [{ amountCents: 2_500, compulsory: true }, { amountCents: 900, compulsory: false }])).toBe(42_500)
    expect(commissionFor({ type: 'FIXED', fixedCents: 8_000, percentBps: null }, 42_500)).toBe(8_000)
    expect(commissionFor({ type: 'PERCENT', fixedCents: null, percentBps: 1_500 }, 42_500)).toBe(6_375)
    expect(commissionFor(null, 42_500)).toBe(0)
    const old = { validFrom: new Date('2026-01-01'), validTo: new Date('2026-06-01') }
    const current = { validFrom: new Date('2026-06-01'), validTo: null }
    expect(activeTerms([old, current], new Date('2026-03-01'))).toBe(old)
    expect(activeTerms([old, current], new Date('2026-07-01'))).toBe(current)
  })
})

describe('normalisation and duplicates', () => {
  it('normalises names, domains and German phone numbers', () => {
    expect(normalizeName('Sprachschule Müller GmbH')).toBe('sprachschule mueller')
    expect(normalizeDomain('WWW.Example.de/kontakt')).toBe('example.de')
    expect(normalizePhone('0201 / 123 45-6')).toBe('492011234' + '56')
    expect(normalizePhone('+49 (0)201 123456')).toBe('4902011234' + '56')
  })

  it('scores a shared domain as a duplicate', () => {
    const a = { nameNormalized: 'lingua', websiteDomain: 'lingua.de', phoneNormalized: null, publicEmail: null, cityId: 'c', postcodes: [] }
    const b = { ...a, nameNormalized: 'lingua sprachschule essen' }
    expect(scoreDuplicate(a, b).score).toBeGreaterThanOrEqual(50)
    expect(scoreDuplicate(a, { ...b, websiteDomain: 'other.de', nameNormalized: 'totally different' }).score).toBe(0)
  })
})

describe('csv', () => {
  it('parses quoted fields and semicolons, and neutralises formulas on export', () => {
    expect(parseCsv('a;b\n"x;1";"he said ""hi"""\n')).toEqual([['a', 'b'], ['x;1', 'he said "hi"']])
    expect(toCsv(['n'], [['=SUM(A1)']])).toContain("'=SUM(A1)")
  })

  it('parses money input in German and English formats', () => {
    expect(parseMoneyToCents('1.299,50')).toBe(129_950)
    expect(parseMoneyToCents('199.5')).toBe(19_950)
    expect(parseMoneyToCents('80')).toBe(8_000)
  })
})

describe('translations', () => {
  it('every message exists in every locale and is non-empty', () => {
    const missing: string[] = []
    const walk = (tree: MessageTree, path: string) => {
      for (const [key, node] of Object.entries(tree)) {
        const here = path ? `${path}.${key}` : key
        if (AUTHORED_LOCALES.every((l) => typeof (node as Record<string, unknown>)[l] === 'string')) {
          for (const l of AUTHORED_LOCALES) if (!(node as Record<string, string>)[l].trim()) missing.push(`${here}.${l}`)
        } else if (typeof node === 'object') {
          walk(node as MessageTree, here)
        } else {
          missing.push(here)
        }
      }
    }
    walk(messages, '')
    expect(missing).toEqual([])
  })

  it('negotiates locale and interpolates', () => {
    expect(negotiateLocale('en-US,en;q=0.9,de;q=0.8')).toBe('en')
    expect(negotiateLocale('fr-FR')).toBe('de')
    expect(getTFor('en')('emails.bookingConfirmed.intro', { name: 'Ana', reference: 'NRW-X' })).toContain('NRW-X')
  })
  // Turkish, Ukrainian and Arabic cover everything except the admin console (which falls back to English),
  // plus the older login, signup and registration forms.
  const legacyForms = (['login', 'signup', 'registration'] as const).flatMap((group) =>
    Object.entries(translations.en.forms[group]).map(([k, v]) => [`forms.${group}.${k}`, v as string] as const)
  )
  const english = new Map<string, string>([
    ...messageKeys(messages)
      .filter((k) => !k.startsWith('admin.'))
      .map((k) => [k, lookup(messages, k, 'en')!] as const),
    ...legacyForms,
  ])
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

  for (const locale of ['tr', 'uk', 'ar'] as const) {
    it(`${locale}: every key is translated with the same placeholders`, () => {
      const overlay = OVERLAYS[locale]!
      const missing = [...english.keys()].filter((k) => !overlay[k]?.trim())
      const extra = Object.keys(overlay).filter((k) => !english.has(k))
      const wrongVars = [...english]
        .filter(([k, en]) => overlay[k] && placeholders(overlay[k]).join() !== placeholders(en).join())
        .map(([k]) => k)
      expect({ missing, extra, wrongVars }).toEqual({ missing: [], extra: [], wrongVars: [] })
    })
  }

  it('falls back to English for untranslated keys and formats per language', () => {
    expect(getTFor('tr')('common.save')).toBe('Kaydet')
    expect(getTFor('ar')('admin.nav.overview')).toBe('Overview')
    expect(negotiateLocale('uk-UA,uk;q=0.9')).toBe('uk')
    expect(intlLocale('ar')).toBe('ar-u-nu-latn')
    expect(languageName({ code: 'de', nameEn: 'German', nameDe: 'Deutsch' }, 'tr')).toBe('Almanca')
  })
})
