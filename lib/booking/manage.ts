// School and admin operations on bookings. Every change that frees or takes a
// seat locks the intake first, exactly like marketplace checkout.

import { z } from 'zod'
import { prisma } from '../prisma'
import { audit } from '../audit'
import { AppError } from '../errors'
import { assertPermission, assertPlatformAdmin, assertSameSchool, type Actor, type SchoolActor } from '../permissions'
import { countSeats, executeRefund, lockIntake, TX_OPTIONS } from './inventory'
import { generateBookingReference } from '../tokens'
import * as notify from '../notify'
import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

async function uniqueReference(tx: Tx) {
  for (;;) {
    const reference = generateBookingReference()
    if (!(await tx.booking.findUnique({ where: { reference }, select: { id: true } }))) return reference
  }
}

// ---------------------------------------------------------------------------
// Direct enrolments
// ---------------------------------------------------------------------------

export const directEnrolmentSchema = z.object({
  studentName: z.string().trim().min(2),
  studentEmail: z.string().trim().toLowerCase().email(),
  studentPhone: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  notes: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  priceCents: z.number().int().min(0).optional(),
  paidCents: z.number().int().min(0).default(0),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER']).default('BANK_TRANSFER'),
  sendConfirmation: z.boolean().default(true),
})
export type DirectEnrolmentInput = z.input<typeof directEnrolmentSchema>

/**
 * A student the school recruited itself. Uses the same seat inventory as the
 * marketplace, so the seat disappears from search the moment this commits.
 * Direct enrolments are allowed while marketplace booking is paused, but never beyond capacity.
 */
export async function createDirectEnrolment(actor: SchoolActor, intakeId: string, input: DirectEnrolmentInput, now = new Date()) {
  assertPermission(actor, 'manageBookings')
  const data = directEnrolmentSchema.parse(input)

  const outcome = await prisma.$transaction(async (tx) => {
    const intake = await lockIntake(tx, intakeId)
    assertSameSchool(actor, intake)
    if (intake.status === 'CLOSED' || intake.archivedAt) throw new AppError('INTAKE_NOT_BOOKABLE', 'CLOSED')

    const seats = await countSeats(tx, intakeId, now)
    if (seats.taken >= intake.capacity) throw new AppError('NO_SEATS')

    const linkedUser = await tx.user.findUnique({ where: { email: data.studentEmail }, select: { id: true, student: { select: { id: true } } } })
    const priceCents = data.priceCents ?? intake.priceCents
    const feesCents = data.priceCents === undefined ? intake.totalPriceCents - intake.priceCents : 0

    const booking = await tx.booking.create({
      data: {
        reference: await uniqueReference(tx),
        intakeId,
        schoolId: intake.schoolId,
        channel: 'DIRECT',
        status: 'CONFIRMED',
        confirmedAt: now,
        studentUserId: linkedUser?.id,
        studentId: linkedUser?.student?.id,
        studentName: data.studentName,
        studentEmail: data.studentEmail,
        studentPhone: data.studentPhone,
        priceCents,
        feesCents,
        totalCents: priceCents + feesCents,
        currency: intake.currency,
        paymentMethod: data.paidCents > 0 ? data.paymentMethod : null,
        notes: data.notes,
        createdById: actor.userId,
      },
    })
    if (data.paidCents > 0) {
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          schoolId: intake.schoolId,
          amountCents: data.paidCents,
          currency: intake.currency,
          method: data.paymentMethod,
          recordedById: actor.userId,
        },
      })
    }
    await audit(tx, {
      actorId: actor.userId,
      schoolId: intake.schoolId,
      entity: 'Booking',
      entityId: booking.id,
      action: 'booking.direct_enrolment',
      after: { intakeId, studentEmail: data.studentEmail, totalCents: booking.totalCents, paidCents: data.paidCents },
    })
    return { booking, seatsLeft: intake.capacity - seats.taken - 1 }
  }, TX_OPTIONS)

  if (data.sendConfirmation) await notify.bookingConfirmed(outcome.booking.id, outcome.seatsLeft)
  return outcome
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

export const cancelSchema = z.object({
  reason: z.string().trim().min(2),
  refundCents: z.number().int().min(0).default(0),
  notifyStudent: z.boolean().default(true),
})
export type CancelInput = z.input<typeof cancelSchema>

async function cancelInTx(tx: Tx, actorId: string, bookingId: string, data: z.output<typeof cancelSchema>, now: Date, schoolId?: string) {
  const current = await tx.booking.findUnique({ where: { id: bookingId }, select: { intakeId: true, schoolId: true } })
  if (!current || (schoolId && current.schoolId !== schoolId)) throw new AppError('NOT_FOUND')
  await lockIntake(tx, current.intakeId)
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { payments: { include: { refunds: true } } } })
  if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING_PAYMENT') {
    throw new AppError('CONFLICT', 'Only confirmed or pending bookings can be cancelled')
  }

  // Refund against payments, card payments first, never more than was paid.
  const refundable = booking.payments
    .filter((p) => p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED')
    .map((p) => ({
      payment: p,
      remaining: p.amountCents - p.refunds.filter((r) => r.status !== 'FAILED').reduce((s, r) => s + r.amountCents, 0),
    }))
    .sort((a, b) => Number(!!b.payment.providerPaymentId) - Number(!!a.payment.providerPaymentId))
  const maxRefund = refundable.reduce((s, r) => s + r.remaining, 0)
  if (data.refundCents > maxRefund) throw new AppError('VALIDATION', 'The refund is larger than the amount paid')

  await tx.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED', cancelledAt: now, cancelReason: data.reason },
  })
  await tx.seatHold.updateMany({ where: { bookingId, status: 'ACTIVE' }, data: { status: 'RELEASED', releasedAt: now } })

  const refundIds: string[] = []
  let left = data.refundCents
  for (const entry of refundable) {
    if (left <= 0) break
    const amount = Math.min(left, entry.remaining)
    if (amount <= 0) continue
    const refund = await tx.refund.create({
      data: { paymentId: entry.payment.id, bookingId, amountCents: amount, reason: data.reason, createdById: actorId },
    })
    refundIds.push(refund.id)
    left -= amount
  }

  await audit(tx, {
    actorId,
    schoolId: booking.schoolId,
    entity: 'Booking',
    entityId: bookingId,
    action: 'booking.cancelled',
    before: { status: booking.status },
    after: { status: 'CANCELLED', reason: data.reason, refundCents: data.refundCents },
  })
  // Any open support request about cancelling this booking is now handled.
  await tx.supportRequest.updateMany({
    where: { bookingId, type: 'CANCELLATION', status: { not: 'RESOLVED' } },
    data: { status: 'RESOLVED', resolvedAt: now, resolution: data.reason },
  })
  return refundIds
}

async function afterCancel(bookingId: string, refundIds: string[], data: z.output<typeof cancelSchema>) {
  for (const id of refundIds) await executeRefund(id)
  if (data.notifyStudent) await notify.bookingCancelled(bookingId, data.refundCents)
}

export async function cancelBookingAsSchool(actor: SchoolActor, bookingId: string, input: CancelInput, now = new Date()) {
  assertPermission(actor, 'manageBookings')
  const data = cancelSchema.parse(input)
  const refundIds = await prisma.$transaction((tx) => cancelInTx(tx, actor.userId, bookingId, data, now, actor.schoolId), TX_OPTIONS)
  await afterCancel(bookingId, refundIds, data)
}

export async function cancelBookingAsAdmin(actor: Actor, bookingId: string, input: CancelInput, now = new Date()) {
  assertPlatformAdmin(actor)
  const data = cancelSchema.parse(input)
  const refundIds = await prisma.$transaction((tx) => cancelInTx(tx, actor.userId, bookingId, data, now), TX_OPTIONS)
  await afterCancel(bookingId, refundIds, data)
}

/** A student asks to cancel. Cancellation terms vary by school, so a person decides. */
export async function requestCancellation(actor: Actor, bookingId: string, message: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking || booking.studentUserId !== actor.userId) throw new AppError('NOT_FOUND')
  if (booking.status !== 'CONFIRMED') throw new AppError('CONFLICT')
  if (booking.cancellationRequestedAt) return booking
  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({ where: { id: bookingId }, data: { cancellationRequestedAt: new Date() } })
    await tx.supportRequest.create({
      data: {
        type: 'CANCELLATION',
        subject: `Cancellation request ${booking.reference}`,
        message: message.trim() || '—',
        email: actor.email,
        requesterId: actor.userId,
        bookingId,
        schoolId: booking.schoolId,
      },
    })
    await tx.notification.create({
      data: {
        schoolId: booking.schoolId,
        type: 'booking.cancellation_requested',
        title: `Stornierungsanfrage ${booking.reference}`,
        body: message.slice(0, 300),
        link: `/school/bookings/${bookingId}`,
      },
    })
    await audit(tx, { actorId: actor.userId, schoolId: booking.schoolId, entity: 'Booking', entityId: bookingId, action: 'booking.cancellation_requested' })
    return updated
  })
}

// ---------------------------------------------------------------------------
// Transfer
// ---------------------------------------------------------------------------

/**
 * Moves a confirmed student to another intake of the same school. The old
 * booking is kept as TRANSFERRED and linked to the new one; payments follow the student.
 */
export async function transferBooking(actor: SchoolActor, bookingId: string, toIntakeId: string, reason: string, now = new Date()) {
  assertPermission(actor, 'manageBookings')
  if (!reason.trim()) throw new AppError('VALIDATION', 'A reason is required')

  const newBookingId = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } })
    assertSameSchool(actor, booking)
    if (booking.intakeId === toIntakeId) throw new AppError('VALIDATION', 'Choose a different intake')

    // Lock both intakes in a fixed order so two opposite transfers cannot deadlock.
    const [firstId, secondId] = [booking.intakeId, toIntakeId].sort()
    const first = await lockIntake(tx, firstId)
    const second = await lockIntake(tx, secondId)
    const target = first.id === toIntakeId ? first : second
    assertSameSchool(actor, target)

    const fresh = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } })
    if (fresh.status !== 'CONFIRMED') throw new AppError('CONFLICT', 'Only confirmed bookings can be transferred')
    if (target.status === 'CLOSED' || target.archivedAt) throw new AppError('INTAKE_NOT_BOOKABLE', 'CLOSED')

    const seats = await countSeats(tx, target.id, now)
    if (seats.taken >= target.capacity) throw new AppError('NO_SEATS')

    await tx.booking.update({ where: { id: bookingId }, data: { status: 'TRANSFERRED', cancelledAt: now, cancelReason: `Transferred: ${reason.trim()}` } })
    const moved = await tx.booking.create({
      data: {
        reference: await uniqueReference(tx),
        intakeId: target.id,
        schoolId: target.schoolId,
        channel: fresh.channel,
        status: 'CONFIRMED',
        confirmedAt: now,
        studentUserId: fresh.studentUserId,
        studentId: fresh.studentId,
        studentName: fresh.studentName,
        studentEmail: fresh.studentEmail,
        studentPhone: fresh.studentPhone,
        priceCents: target.priceCents,
        feesCents: target.totalPriceCents - target.priceCents,
        totalCents: target.totalPriceCents,
        currency: target.currency,
        paymentMethod: fresh.paymentMethod,
        // Commission was earned on the original booking; it moves with the student, not charged twice.
        commissionCents: fresh.commissionCents,
        commissionTermsId: fresh.commissionTermsId,
        transferredFromId: fresh.id,
        notes: fresh.notes,
        createdById: actor.userId,
      },
    })
    await tx.payment.updateMany({ where: { bookingId }, data: { bookingId: moved.id } })
    await tx.refund.updateMany({ where: { bookingId }, data: { bookingId: moved.id } })
    await audit(tx, {
      actorId: actor.userId,
      schoolId: actor.schoolId,
      entity: 'Booking',
      entityId: bookingId,
      action: 'booking.transferred',
      before: { intakeId: fresh.intakeId, totalCents: fresh.totalCents },
      after: { intakeId: target.id, newBookingId: moved.id, totalCents: moved.totalCents, reason: reason.trim() },
    })
    return moved.id
  }, TX_OPTIONS)

  await notify.bookingTransferred(newBookingId)
  return newBookingId
}

// ---------------------------------------------------------------------------
// Payments recorded by the school
// ---------------------------------------------------------------------------

export const recordPaymentSchema = z.object({
  amountCents: z.number().int().positive(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER']),
  paidAt: z.string().optional(),
  note: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
})

export async function recordPayment(actor: SchoolActor, bookingId: string, input: z.input<typeof recordPaymentSchema>) {
  assertPermission(actor, 'manageBookings')
  const data = recordPaymentSchema.parse(input)
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } })
    assertSameSchool(actor, booking)
    if (booking.status !== 'CONFIRMED') throw new AppError('CONFLICT')
    const payment = await tx.payment.create({
      data: {
        bookingId,
        schoolId: booking.schoolId,
        amountCents: data.amountCents,
        currency: booking.currency,
        method: data.method,
        paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
        note: data.note,
        recordedById: actor.userId,
      },
    })
    await audit(tx, {
      actorId: actor.userId,
      schoolId: booking.schoolId,
      entity: 'Payment',
      entityId: payment.id,
      action: 'payment.recorded',
      after: { bookingId, amountCents: data.amountCents, method: data.method },
    })
    return payment
  })
}

/** Amount paid (net of refunds) and still outstanding for a booking. */
export function paymentSummary(booking: {
  totalCents: number
  status: string
  payments: { amountCents: number; status: string; refunds?: { amountCents: number; status: string }[] }[]
}) {
  const paid = booking.payments
    .filter((p) => p.status !== 'FAILED' && p.status !== 'PENDING')
    .reduce((sum, p) => sum + p.amountCents - (p.refunds ?? []).filter((r) => r.status !== 'FAILED').reduce((s, r) => s + r.amountCents, 0), 0)
  const outstanding = booking.status === 'CONFIRMED' ? Math.max(0, booking.totalCents - paid) : 0
  return { paid, outstanding }
}
