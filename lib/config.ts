// Central place for platform-wide settings that come from the environment.

export const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Superb'

export const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

export const TIME_ZONE = 'Europe/Berlin'

export const DEFAULT_CURRENCY = 'EUR'

/** How long a seat stays held while a student is in checkout. */
export const SEAT_HOLD_MINUTES = Number(process.env.SEAT_HOLD_MINUTES || 15)

/** Published courses whose information is older than this are flagged as stale. */
export const STALE_AFTER_DAYS = Number(process.env.STALE_AFTER_DAYS || 30)

/** Invitations (claim and staff) expire after this many days. */
export const INVITATION_TTL_DAYS = 14

/** Max upload size for proof-of-authority documents. */
export const CLAIM_DOCUMENT_MAX_BYTES = 3 * 1024 * 1024

export function absoluteUrl(path: string) {
  return `${APP_URL}${path.startsWith('/') ? path : `/${path}`}`
}
