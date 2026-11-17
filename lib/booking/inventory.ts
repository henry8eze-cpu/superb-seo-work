// Seat inventory and instant booking.
//
// Invariant: for every intake,
//   CONFIRMED bookings (marketplace + direct) + ACTIVE unexpired holds ≤ capacity.
//
// Every operation that can take a seat runs in a transaction that first locks
// the intake row (SELECT … FOR UPDATE). Concurrent attempts on the same intake
// therefore queue up and each one re-counts after the previous one commits, so
// the last seat can only ever be taken once.

import { Prisma, type Booking, type BookingChannel, type PaymentMethod } from '@prisma/client'
import { prisma } from '../prisma'
import { audit } from '../audit'
import { AppError } from '../errors'
import { SEAT_HOLD_MINUTES, absoluteUrl } from '../config'
import { generateBookingReference } from '../tokens'
import type { Actor } from '../permissions'
import { getPaymentProvider, type PaymentEvent } from '../payments'
import { activeTerms, bookingMode, commissionFor, schoolAcceptsInstantBooking } from './rules'
import * as notify from '../notify'

type Tx = Prisma.TransactionClient

export const TX_OPTIONS = {
  maxWait: 15_000,
  timeout: 30_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
}

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

/** Locks the intake row for the rest of the transaction and returns it with what the rules need. */
export async function lockIntake(tx: Tx, intakeId: string) {
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "intakes" WHERE "id" = ${intakeId} FOR UPDATE`
  if (locked.length === 0) throw new AppError('NOT_FOUND')
  return tx.intake.findUniqueOrThrow({
    where: { id: intakeId },
    include: { courseType: true, school: true, fees: true },
  })
}

export async function countSeats(db: Tx | typeof prisma, intakeId: string, now = new Date()) {
  const confirmed = await db.booking.count({ where: { intakeId, status: 'CONFIRMED' } })
  const held = await db.seatHold.count({ where: { intakeId, status: 'ACTIVE', expiresAt: { gt: now } } })
  return { confirmed, held, taken: confirmed + held }
}

export type Availability = { capacity: number; confirmed: number; held: number; available: number }

/** Seat counts for many intakes at once (listings, dashboards). */
export async function getAvailability(intakeIds: string[], now = new Date()): Promise<Map<string, Availability>> {
  const result = new Map<string, Availability>()
  if (intakeIds.length === 0) return result
  const [intakes, confirmed, held] = await Promise.all([
    prisma.intake.findMany({ where: { id: { in: intakeIds } }, select: { id: true, capacity: true } }),
    prisma.booking.groupBy({ by: ['intakeId'], where: { intakeId: { in: intakeIds }, status: 'CONFIRMED' }, _count: { _all: true } }),
    prisma.seatHold.groupBy({
      by: ['intakeId'],
      where: { intakeId: { in: intakeIds }, status: 'ACTIVE', expiresAt: { gt: now } },
      _count: { _all: true },
    }),
  ])
  for (const intake of intakes) {
    const c = confirmed.find((row) => row.intakeId === intake.id)?._count._all ?? 0
    const h = held.find((row) => row.intakeId === intake.id)?._count._all ?? 0
    result.set(intake.id, { capacity: intake.capacity, confirmed: c, held: h, available: Math.max(0, intake.capacity - c - h) })
  }
  return result
}

async function uniqueReference(tx: Tx) {
  for (;;) {
    const reference = generateBookingReference()
    if (!(await tx.booking.findUnique({ where: { reference }, select: { id: true } }))) return reference
  }
}

/** Marks lapsed holds on one intake as expired. Called inside the intake lock. */
async function expireLapsedHolds(tx: Tx, intakeId: string, now: Date) {
  const lapsed = await tx.seatHold.findMany({
    where: { intakeId, status: 'ACTIVE', expiresAt: { lte: now } },
    select: { id: true, bookingId: true },
  })
  if (lapsed.length === 0) return
  await tx.seatHold.updateMany({ where: { id: { in: lapsed.map((h) => h.id) }, status: 'ACTIVE' }, data: { status: 'EXPIRED', releasedAt: now } })
  await tx.booking.updateMany({
    where: { id: { in: lapsed.map((h) => h.bookingId) }, status: 'PENDING_PAYMENT' },
    data: { status: 'EXPIRED' },
  })
}

// ---------------------------------------------------------------------------
// Holding a seat
// ---------------------------------------------------------------------------

export type HoldResult = Booking & { hold: { id: string; expiresAt: Date } }

/**
 * Places a short hold on one seat for a student starting checkout.
 * Refuses unless the intake is instantly bookable right now.
 */
export async function createSeatHold(
  actor: Actor,
  intakeId: string,
  student: { name: string; email: string; phone?: string | null },
  now = new Date()
): Promise<HoldResult> {
  const result = await prisma.$transaction(async (tx) => {
    const intake = await lockIntake(tx, intakeId)
    await expireLapsedHolds(tx, intakeId, now)

    const alreadyBooked = await tx.booking.findFirst({
      where: { intakeId, studentUserId: actor.userId, status: 'CONFIRMED' },
      select: { id: true },
    })
    if (alreadyBooked) throw new AppError('CONFLICT', 'You have already booked this course', { bookingId: alreadyBooked.id })

    // Resume an existing checkout instead of taking a second seat.
    const existing = await tx.booking.findFirst({
      where: { intakeId, studentUserId: actor.userId, status: 'PENDING_PAYMENT', hold: { status: 'ACTIVE', expiresAt: { gt: now } } },
      include: { hold: true },
    })
    if (existing?.hold) return { ...existing, hold: existing.hold }

    if (!schoolAcceptsInstantBooking(intake.school)) throw new AppError('NOT_PARTNER')

    const seats = await countSeats(tx, intakeId, now)
    const available = intake.capacity - seats.taken
    const { mode, reason } = bookingMode({ school: intake.school, courseType: intake.courseType, intake, available, now })
    if (mode !== 'INSTANT') {
      throw new AppError(reason === 'FULL' ? 'NO_SEATS' : 'INTAKE_NOT_BOOKABLE', reason)
    }

    const feesCents = intake.totalPriceCents - intake.priceCents
    const booking = await tx.booking.create({
      data: {
        reference: await uniqueReference(tx),
        intakeId,
        schoolId: intake.schoolId,
        channel: 'MARKETPLACE',
        status: 'PENDING_PAYMENT',
        studentUserId: actor.userId,
        studentId: (await tx.student.findUnique({ where: { userId: actor.userId }, select: { id: true } }))?.id,
        studentName: student.name,
        studentEmail: student.email,
        studentPhone: student.phone || null,
        priceCents: intake.priceCents,
        feesCents,
        totalCents: intake.totalPriceCents,
        currency: intake.currency,
      },
    })
    const hold = await tx.seatHold.create({
      data: { intakeId, bookingId: booking.id, expiresAt: new Date(now.getTime() + SEAT_HOLD_MINUTES * 60_000) },
    })
    await audit(tx, {
      actorId: actor.userId,
      schoolId: intake.schoolId,
      entity: 'Booking',
      entityId: booking.id,
      action: 'booking.hold_created',
      after: { intakeId, expiresAt: hold.expiresAt, seatsAvailableBefore: available },
    })
    await tx.analyticsEvent.create({
      data: { type: 'checkout_started', userId: actor.userId, schoolId: intake.schoolId, intakeId },
    })
    return { ...booking, hold }
  }, TX_OPTIONS)

  return result
}

/** The student leaves checkout: give the seat back straight away. */
export async function releaseSeatHold(actor: Actor, bookingId: string) {
  const booking = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { hold: true } })
    if (!booking || booking.studentUserId !== actor.userId) throw new AppError('NOT_FOUND')
    await lockIntake(tx, booking.intakeId)
    if (booking.status !== 'PENDING_PAYMENT') return booking
    await releaseHoldInTx(tx, booking.id, new Date(), 'booking.hold_released', actor.userId)
    return booking
  }, TX_OPTIONS)
  if (booking.checkoutSessionId) await getPaymentProvider().expireCheckout(booking.checkoutSessionId)
}

async function releaseHoldInTx(tx: Tx, bookingId: string, now: Date, action: string, actorId?: string) {
  const booking = await tx.booking.update({ where: { id: bookingId }, data: { status: 'EXPIRED' } })
  await tx.seatHold.updateMany({ where: { bookingId, status: 'ACTIVE' }, data: { status: 'RELEASED', releasedAt: now } })
  await audit(tx, { actorId, actorType: actorId ? 'USER' : 'SYSTEM', schoolId: booking.schoolId, entity: 'Booking', entityId: bookingId, action })
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export async function startCardCheckout(actor: Actor, bookingId: string, locale: string, now = new Date()) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { hold: true, intake: { include: { courseType: true, school: true } } },
  })
  if (!booking || booking.studentUserId !== actor.userId) throw new AppError('NOT_FOUND')
  if (booking.status !== 'PENDING_PAYMENT' || !booking.hold || booking.hold.status !== 'ACTIVE' || booking.hold.expiresAt <= now) {
    throw new AppError('HOLD_EXPIRED')
  }
  if (!schoolAcceptsInstantBooking(booking.intake.school)) throw new AppError('NOT_PARTNER')

  const session = await getPaymentProvider().createCheckout({
    bookingId: booking.id,
    holdId: booking.hold.id,
    amountCents: booking.totalCents,
    currency: booking.currency,
    description: `${booking.intake.courseType.name} – ${booking.intake.school.name} (${booking.reference})`,
    customerEmail: booking.studentEmail,
    successUrl: absoluteUrl(`/checkout/${booking.id}/success`),
    cancelUrl: absoluteUrl(`/checkout/${booking.id}?cancelled=1`),
    expiresAt: booking.hold.expiresAt,
    locale,
  })
  await prisma.booking.update({ where: { id: booking.id }, data: { checkoutSessionId: session.id, paymentMethod: 'CARD' } })
  return session
}

/** Confirms without card payment, only where the school has expressly enabled paying at the school. */
export async function confirmPayAtSchool(actor: Actor, bookingId: string, now = new Date()) {
  const outcome = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { school: true } })
    if (!booking || booking.studentUserId !== actor.userId) throw new AppError('NOT_FOUND')
    if (!booking.school.allowPayAtSchool) throw new AppError('FORBIDDEN', 'This school does not offer paying at the school')
    return confirmInTx(tx, bookingId, { paymentMethod: 'PAY_AT_SCHOOL', actorId: actor.userId, now })
  }, TX_OPTIONS)
  if (!outcome.ok) throw new AppError(outcome.reason === 'NO_SEATS' ? 'NO_SEATS' : outcome.reason === 'NOT_PARTNER' ? 'NOT_PARTNER' : 'HOLD_EXPIRED')
  if (!outcome.alreadyConfirmed) await notify.bookingConfirmed(bookingId, outcome.seatsLeft)
  return outcome
}

type ConfirmOutcome =
  | { ok: true; alreadyConfirmed: boolean; seatsLeft: number }
  | { ok: false; reason: 'NO_SEATS' | 'NOT_BOOKABLE' | 'NOT_PARTNER' | 'BOOKING_CLOSED' }

/**
 * Turns a held booking into a confirmed one. Must run inside a transaction;
 * locks the intake first. Idempotent: a booking that is already confirmed is reported as such.
 */
async function confirmInTx(
  tx: Tx,
  bookingId: string,
  opts: { paymentMethod: PaymentMethod; actorId?: string; now: Date }
): Promise<ConfirmOutcome> {
  const initial = await tx.booking.findUnique({ where: { id: bookingId }, select: { intakeId: true } })
  if (!initial) throw new AppError('NOT_FOUND')
  const intake = await lockIntake(tx, initial.intakeId)
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { hold: true } })

  if (booking.status === 'CONFIRMED') {
    const seats = await countSeats(tx, intake.id, opts.now)
    return { ok: true, alreadyConfirmed: true, seatsLeft: Math.max(0, intake.capacity - seats.taken) }
  }
  // Only a checkout in progress (or one that lapsed moments ago) can be confirmed.
  if (booking.status !== 'PENDING_PAYMENT' && booking.status !== 'EXPIRED') return { ok: false, reason: 'BOOKING_CLOSED' }

  // The same rules as search and checkout: a school that has not agreed to take instant bookings never gets one.
  if (!schoolAcceptsInstantBooking(intake.school)) return { ok: false, reason: 'NOT_PARTNER' }

  const holdIsLive = booking.hold?.status === 'ACTIVE' && booking.hold.expiresAt > opts.now
  const seats = await countSeats(tx, intake.id, opts.now)
  // A live hold already counts towards `taken`; a lapsed one does not, so it needs a free seat.
  const available = intake.capacity - seats.taken + (holdIsLive ? 1 : 0)
  // Judge bookability as of when the hold was placed for the deadline, but use the
  // intake's current status: a school can close or pause an intake at any moment.
  const { mode, reason } = bookingMode({
    school: intake.school,
    courseType: intake.courseType,
    intake,
    available,
    now: holdIsLive && booking.hold ? booking.hold.createdAt : opts.now,
  })
  if (mode !== 'INSTANT') return { ok: false, reason: reason === 'FULL' ? 'NO_SEATS' : 'NOT_BOOKABLE' }

  const terms = activeTerms(await tx.commissionTerms.findMany({ where: { schoolId: intake.schoolId } }), opts.now)
  await tx.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CONFIRMED',
      confirmedAt: opts.now,
      paymentMethod: opts.paymentMethod,
      commissionCents: commissionFor(terms, booking.totalCents),
      commissionTermsId: terms?.id ?? null,
    },
  })
  if (booking.hold) {
    await tx.seatHold.update({ where: { id: booking.hold.id }, data: { status: 'CONVERTED', releasedAt: opts.now } })
  }
  const after = await countSeats(tx, intake.id, opts.now)
  await audit(tx, {
    actorId: opts.actorId,
    actorType: opts.actorId ? 'USER' : 'PAYMENT_PROVIDER',
    schoolId: intake.schoolId,
    entity: 'Booking',
    entityId: bookingId,
    action: 'booking.confirmed',
    after: { paymentMethod: opts.paymentMethod, commissionCents: commissionFor(terms, booking.totalCents), seatsLeft: intake.capacity - after.taken },
  })
  return { ok: true, alreadyConfirmed: false, seatsLeft: Math.max(0, intake.capacity - after.taken) }
}

// ---------------------------------------------------------------------------
// Payment provider events
// ---------------------------------------------------------------------------

export type PaymentEventResult =
  | { status: 'duplicate' }
  | { status: 'ignored' }
  | { status: 'confirmed'; bookingId: string; seatsLeft: number }
  | { status: 'already_confirmed'; bookingId: string }
  | { status: 'refunded'; bookingId: string; refundId: string }
  | { status: 'released'; bookingId: string }

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

/**
 * Applies one provider event exactly once.
 * - Each event id is recorded in the same transaction as its effect, so a redelivered event is a no-op.
 * - Payments are unique by provider payment id, so two different events about the same payment
 *   can never create a second payment or booking.
 * - A payment that cannot be turned into a confirmed seat is refunded in full.
 */
export async function handlePaymentEvent(event: PaymentEvent, now = new Date()): Promise<PaymentEventResult> {
  if (event.kind === 'ignored') return { status: 'ignored' }

  if (event.kind === 'checkout_expired') {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.processedWebhookEvent.create({ data: { id: event.eventId, provider: 'payments', type: event.kind } })
        const booking = await tx.booking.findUnique({ where: { id: event.bookingId } })
        if (!booking) return { status: 'ignored' as const }
        await lockIntake(tx, booking.intakeId)
        const fresh = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } })
        if (fresh.status === 'PENDING_PAYMENT' && fresh.checkoutSessionId === event.sessionId) {
          await releaseHoldInTx(tx, booking.id, now, 'booking.checkout_expired')
          return { status: 'released' as const, bookingId: booking.id }
        }
        return { status: 'ignored' as const }
      }, TX_OPTIONS)
    } catch (error) {
      if (isUniqueViolation(error)) return { status: 'duplicate' }
      throw error
    }
  }

  // checkout_completed
  let outcome:
    | { kind: 'duplicate' }
    | { kind: 'confirmed'; seatsLeft: number; alreadyConfirmed: boolean; bookingId: string }
    | { kind: 'refund'; refundId: string; bookingId: string; paymentId: string; amountCents: number }

  try {
    outcome = await prisma.$transaction(async (tx) => {
      await tx.processedWebhookEvent.create({ data: { id: event.eventId, provider: 'payments', type: event.kind } })

      const existingPayment = await tx.payment.findUnique({ where: { providerPaymentId: event.paymentId } })
      if (existingPayment) return { kind: 'duplicate' as const }

      const booking = await tx.booking.findUnique({ where: { id: event.bookingId } })
      if (!booking) throw new Error(`Payment ${event.paymentId} refers to unknown booking ${event.bookingId}`)

      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          schoolId: booking.schoolId,
          amountCents: event.amountCents,
          currency: event.currency,
          method: 'CARD',
          status: 'SUCCEEDED',
          providerPaymentId: event.paymentId,
          providerSessionId: event.sessionId,
          paidAt: now,
        },
      })
      await audit(tx, {
        actorType: 'PAYMENT_PROVIDER',
        schoolId: booking.schoolId,
        entity: 'Payment',
        entityId: payment.id,
        action: 'payment.received',
        after: { bookingId: booking.id, amountCents: event.amountCents },
      })

      const amountMatches = event.amountCents === booking.totalCents && event.currency === booking.currency
      const confirmation = amountMatches
        ? await confirmInTx(tx, booking.id, { paymentMethod: 'CARD', now })
        : ({ ok: false, reason: 'NOT_BOOKABLE' } as const)

      if (confirmation.ok) {
        return { kind: 'confirmed' as const, seatsLeft: confirmation.seatsLeft, alreadyConfirmed: confirmation.alreadyConfirmed, bookingId: booking.id }
      }

      // Paid, but no seat can be confirmed: never keep the money.
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'FAILED_REFUNDED', cancelReason: `unconfirmable:${confirmation.reason}` },
      })
      await tx.seatHold.updateMany({ where: { bookingId: booking.id, status: 'ACTIVE' }, data: { status: 'RELEASED', releasedAt: now } })
      const refund = await tx.refund.create({
        data: { paymentId: payment.id, bookingId: booking.id, amountCents: event.amountCents, reason: `Booking could not be confirmed (${confirmation.reason})` },
      })
      await audit(tx, {
        actorType: 'SYSTEM',
        schoolId: booking.schoolId,
        entity: 'Booking',
        entityId: booking.id,
        action: 'booking.failed_refunded',
        after: { reason: confirmation.reason, refundCents: event.amountCents },
      })
      return { kind: 'refund' as const, refundId: refund.id, bookingId: booking.id, paymentId: event.paymentId, amountCents: event.amountCents }
    }, TX_OPTIONS)
  } catch (error) {
    if (isUniqueViolation(error)) return { status: 'duplicate' }
    throw error
  }

  if (outcome.kind === 'duplicate') return { status: 'duplicate' }

  if (outcome.kind === 'confirmed') {
    if (outcome.alreadyConfirmed) return { status: 'already_confirmed', bookingId: outcome.bookingId }
    await notify.bookingConfirmed(outcome.bookingId, outcome.seatsLeft)
    return { status: 'confirmed', bookingId: outcome.bookingId, seatsLeft: outcome.seatsLeft }
  }

  await executeRefund(outcome.refundId)
  await notify.bookingRefunded(outcome.bookingId, outcome.amountCents)
  return { status: 'refunded', bookingId: outcome.bookingId, refundId: outcome.refundId }
}

/**
 * Sends a PENDING/FAILED refund to the provider. Uses the refund id as the
 * idempotency key, so retrying is always safe.
 */
export async function executeRefund(refundId: string) {
  const refund = await prisma.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } })
  if (refund.status === 'SUCCEEDED') return refund

  if (!refund.payment.providerPaymentId) {
    // Money taken outside the platform (cash, bank transfer): the school pays it back itself.
    return prisma.refund.update({ where: { id: refundId }, data: { status: 'SUCCEEDED' } })
  }

  let result: { id: string; status: 'SUCCEEDED' | 'PENDING' | 'FAILED' }
  try {
    result = await getPaymentProvider().refund({
      paymentId: refund.payment.providerPaymentId,
      amountCents: refund.amountCents,
      idempotencyKey: `refund-${refund.id}`,
    })
  } catch (error) {
    console.error('[refund] provider call failed', refundId, error)
    result = { id: '', status: 'FAILED' }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.refund.update({
      where: { id: refundId },
      data: { status: result.status, providerRefundId: result.id || refund.providerRefundId },
    })
    if (result.status !== 'FAILED') {
      const refunded = await tx.refund.aggregate({
        where: { paymentId: refund.paymentId, status: { in: ['SUCCEEDED', 'PENDING'] } },
        _sum: { amountCents: true },
      })
      await tx.payment.update({
        where: { id: refund.paymentId },
        data: { status: (refunded._sum.amountCents ?? 0) >= refund.payment.amountCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
      })
    }
    await audit(tx, {
      actorType: 'SYSTEM',
      schoolId: refund.payment.schoolId,
      entity: 'Refund',
      entityId: refundId,
      action: `refund.${result.status.toLowerCase()}`,
      after: { amountCents: refund.amountCents },
    })
    return updated
  })
}

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

/** Expires every lapsed hold and closes the matching checkout sessions. Safe to run at any time. */
export async function expireStaleHolds(now = new Date()) {
  const lapsed = await prisma.seatHold.findMany({
    where: { status: 'ACTIVE', expiresAt: { lte: now } },
    select: { id: true, bookingId: true, booking: { select: { checkoutSessionId: true } } },
    take: 500,
  })
  if (lapsed.length === 0) return 0
  await prisma.$transaction([
    prisma.seatHold.updateMany({ where: { id: { in: lapsed.map((h) => h.id) }, status: 'ACTIVE' }, data: { status: 'EXPIRED', releasedAt: now } }),
    prisma.booking.updateMany({ where: { id: { in: lapsed.map((h) => h.bookingId) }, status: 'PENDING_PAYMENT' }, data: { status: 'EXPIRED' } }),
  ])
  const sessions = lapsed.map((h) => h.booking.checkoutSessionId).filter((id): id is string => !!id)
  if (sessions.length > 0) {
    const provider = getPaymentProvider()
    for (const session of sessions) await provider.expireCheckout(session)
  }
  return lapsed.length
}

/** Retries refunds that did not go through the first time. */
export async function retryPendingRefunds() {
  const refunds = await prisma.refund.findMany({ where: { status: { in: ['PENDING', 'FAILED'] } }, select: { id: true }, take: 100 })
  for (const refund of refunds) await executeRefund(refund.id)
  return refunds.length
}

/** Releases every in-progress checkout on an intake, e.g. when the school pauses or closes it. */
export async function releaseHoldsForIntake(tx: Tx, intakeId: string, now: Date) {
  const holds = await tx.seatHold.findMany({
    where: { intakeId, status: 'ACTIVE' },
    select: { bookingId: true, booking: { select: { checkoutSessionId: true } } },
  })
  for (const hold of holds) await releaseHoldInTx(tx, hold.bookingId, now, 'booking.hold_released_intake_closed')
  return holds.map((h) => h.booking.checkoutSessionId).filter((id): id is string => !!id)
}

export type SeatReservation = {
  intakeId: string
  channel: BookingChannel
}
