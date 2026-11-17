// Normalisation used for duplicate detection and slugs. Pure functions, no DB access.

const LEGAL_SUFFIXES = [
  'gmbh & co. kg',
  'gmbh & co kg',
  'ggmbh',
  'gmbh',
  'ug (haftungsbeschränkt)',
  'ug (haftungsbeschrankt)',
  'ug',
  'e.v.',
  'ev',
  'e. v.',
  'gbr',
  'ohg',
  'kg',
  'ag',
  'mbh',
  'inh.',
]

export function foldGerman(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function normalizeName(name: string) {
  let value = name.toLowerCase().trim()
  for (const suffix of LEGAL_SUFFIXES) {
    if (value.endsWith(` ${suffix}`)) value = value.slice(0, -suffix.length - 1).trim()
  }
  return foldGerman(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function normalizeDomain(url: string | null | undefined) {
  if (!url) return null
  let value = url.trim().toLowerCase()
  if (!value) return null
  if (!/^[a-z]+:\/\//.test(value)) value = `https://${value}`
  try {
    const host = new URL(value).hostname.replace(/^www\./, '')
    return host || null
  } catch {
    return null
  }
}

export function emailDomain(email: string | null | undefined) {
  if (!email || !email.includes('@')) return null
  return email.split('@').pop()!.trim().toLowerCase().replace(/^www\./, '') || null
}

/** German numbers to +49 digits only: "0201 123 45-6" → "492011234556". */
export function normalizePhone(phone: string | null | undefined) {
  if (!phone) return null
  let digits = phone.replace(/[^\d+]/g, '')
  if (!digits) return null
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = `49${digits.slice(1)}`
  digits = digits.replace(/\D/g, '')
  return digits.length >= 6 ? digits : null
}

export function normalizePostcode(postcode: string | null | undefined) {
  if (!postcode) return null
  const match = postcode.match(/\d{5}/)
  return match ? match[0] : null
}

export function normalizeUrl(url: string | null | undefined) {
  if (!url?.trim()) return null
  const value = url.trim()
  return /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`
}

export function slugify(value: string) {
  return foldGerman(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function tokens(value: string) {
  const stop = new Set(['sprachschule', 'sprachinstitut', 'sprachen', 'language', 'school', 'schule', 'institut', 'der', 'die', 'das', 'fuer', 'und'])
  return new Set(value.split(' ').filter((t) => t.length > 1 && !stop.has(t)))
}

/** Jaccard similarity of meaningful name tokens, 0–1. */
export function nameSimilarity(a: string, b: string) {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.size === 0 || tb.size === 0) return a === b ? 1 : 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / (ta.size + tb.size - shared)
}

export type DuplicateComparable = {
  nameNormalized: string
  websiteDomain: string | null
  phoneNormalized: string | null
  publicEmail: string | null
  cityId: string | null
  postcodes: string[]
}

export type DuplicateScore = { score: number; reasons: string[] }

export const DUPLICATE_THRESHOLD = 50

export function scoreDuplicate(a: DuplicateComparable, b: DuplicateComparable): DuplicateScore {
  const reasons: string[] = []
  let score = 0

  if (a.websiteDomain && a.websiteDomain === b.websiteDomain) {
    score += 60
    reasons.push('domain')
  }
  if (a.phoneNormalized && a.phoneNormalized === b.phoneNormalized) {
    score += 50
    reasons.push('phone')
  }
  if (a.publicEmail && b.publicEmail && a.publicEmail.toLowerCase() === b.publicEmail.toLowerCase()) {
    score += 50
    reasons.push('email')
  }
  if (a.nameNormalized === b.nameNormalized) {
    score += a.cityId && a.cityId === b.cityId ? 50 : 35
    reasons.push('name')
  } else if (nameSimilarity(a.nameNormalized, b.nameNormalized) >= 0.6) {
    score += 25
    reasons.push('similar_name')
  }
  if (a.postcodes.some((p) => b.postcodes.includes(p))) {
    score += 15
    reasons.push('postcode')
  }

  return { score: Math.min(100, score), reasons }
}
