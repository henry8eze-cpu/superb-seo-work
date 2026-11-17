// Pure booking rules, shared by search labels, the checkout endpoint and the
// payment webhook so all three always agree.

import type { CommissionTerms, IntakeStatus, PublicationStatus, SchoolStatus } from '@prisma/client'

export type BookingMode = 'INSTANT' | 'ENQUIRY' | 'UNAVAILABLE'

export type UnavailableReason = 'FULL' | 'PAUSED' | 'CLOSED' | 'DEADLINE_PASSED' | 'NOT_PUBLISHED' | 'SCHOOL_NOT_LISTED'

export type BookabilityInput = {
  school: { status: SchoolStatus; instantBookingEnabled: boolean }
  courseType: { publicationStatus: PublicationStatus }
  intake: {
    status: IntakeStatus
    instantBooking: boolean
    bookingDeadline: Date | null
    startDate: Date
    archivedAt: Date | null
  }
  available: number
  now?: Date
}

/** The last moment a place can be booked: the explicit deadline, else the start of the first day. */
export function bookingCloseTime(intake: { bookingDeadline: Date | null; startDate: Date }) {
  return intake.bookingDeadline ?? intake.startDate
}

/** True only for a registered partner that has switched instant booking on. */
export function schoolAcceptsInstantBooking(school: { status: SchoolStatus; instantBookingEnabled: boolean }) {
  return school.status === 'PARTNER' && school.instantBookingEnabled
}

export function bookingMode(input: BookabilityInput): { mode: BookingMode; reason?: UnavailableReason } {
  const now = input.now ?? new Date()
  const { school, courseType, intake } = input

  if (school.status !== 'PARTNER' && school.status !== 'VERIFIED') return { mode: 'UNAVAILABLE', reason: 'SCHOOL_NOT_LISTED' }
  if (courseType.publicationStatus !== 'PUBLISHED' || intake.archivedAt) return { mode: 'UNAVAILABLE', reason: 'NOT_PUBLISHED' }
  if (intake.status === 'CLOSED') return { mode: 'UNAVAILABLE', reason: 'CLOSED' }
  if (intake.status === 'PAUSED') return { mode: 'UNAVAILABLE', reason: 'PAUSED' }
  if (bookingCloseTime(intake) <= now) return { mode: 'UNAVAILABLE', reason: 'DEADLINE_PASSED' }
  if (intake.status === 'FULL' || input.available <= 0) return { mode: 'UNAVAILABLE', reason: 'FULL' }

  if (schoolAcceptsInstantBooking(school) && intake.instantBooking) return { mode: 'INSTANT' }
  return { mode: 'ENQUIRY' }
}

export function totalPrice(priceCents: number, fees: { amountCents: number; compulsory: boolean }[]) {
  return priceCents + fees.filter((f) => f.compulsory).reduce((sum, f) => sum + f.amountCents, 0)
}

/** Commission for one confirmed marketplace booking under the given terms. */
export function commissionFor(terms: Pick<CommissionTerms, 'type' | 'fixedCents' | 'percentBps'> | null, totalCents: number) {
  if (!terms) return 0
  if (terms.type === 'FIXED') return Math.min(terms.fixedCents ?? 0, totalCents)
  return Math.round((totalCents * (terms.percentBps ?? 0)) / 10_000)
}

/** Terms valid at `at`: the latest validFrom ≤ at whose validTo is open or later. */
export function activeTerms<T extends Pick<CommissionTerms, 'validFrom' | 'validTo'>>(terms: T[], at = new Date()) {
  return (
    terms
      .filter((t) => t.validFrom <= at && (!t.validTo || t.validTo > at))
      .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0] ?? null
  )
}
