import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { MockEmailService } from '@/lib/email'
import { AppError } from '@/lib/errors'
import {
  countSeats,
  createSeatHold,
  expireStaleHolds,
  getAvailability,
  handlePaymentEvent,
  startCardCheckout,
  confirmPayAtSchool,
} from '@/lib/booking/inventory'
import { cancelBookingAsSchool, createDirectEnrolment, recordPayment, transferBooking } from '@/lib/booking/manage'
import { setIntakeStatus, updateIntake } from '@/lib/services/courses'
import { searchCourses } from '@/lib/services/search'
import { setCommissionTerms } from '@/lib/services/billing'
import { completedEvent, createIntake, createSchool, createStudent, createUser, mockPayments, staffActor } from './fixtures'

const MINUTE = 60_000

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === code)
}

async function holdAndPay(intakeId: string) {
  const { actor, details } = await createStudent()
  const booking = await createSeatHold(actor, intakeId, details)
  await startCardCheckout(actor, booking.id, 'de')
  const withSession = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
  return { actor, booking: withSession, result: await handlePaymentEvent(completedEvent(withSession)) }
}

describe('instant booking happy path', () => {
  it('confirms a paid booking, emails the student, notifies the school and updates seats', async () => {
    const { school, courseType, owner } = await createSchool()
    const intake = await createIntake(courseType.id, school.id, { capacity: 5, priceCents: 40_000, feeCents: 2_500 })
    await createDirectEnrolment(owner, intake.id, { studentName: 'Direct Student', studentEmail: 'direct@example.test', sendConfirmation: false })

    const { booking, result } = await holdAndPay(intake.id)

    expect(result.status).toBe('confirmed')
    const confirmed = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { payments: true, hold: true } })
    expect(confirmed.status).toBe('CONFIRMED')
    expect(confirmed.reference).toMatch(/^NRW-[A-Z2-9]{6}$/)
    expect(confirmed.totalCents).toBe(42_500)
    expect(confirmed.payments).toHaveLength(1)
    expect(confirmed.hold?.status).toBe('CONVERTED')

    // Immediate confirmation to the student, notification to the school.
    expect(MockEmailService.outbox.some((m) => m.to === booking.studentEmail && m.subject.includes(confirmed.reference))).toBe(true)
    expect(await prisma.notification.count({ where: { schoolId: school.id, type: 'booking.confirmed' } })).toBe(1)
    expect(MockEmailService.outbox.some((m) => m.to === owner.email)).toBe(true)

    // Both the marketplace and the school dashboard read the same numbers.
    const availability = (await getAvailability([intake.id])).get(intake.id)!
    expect(availability).toMatchObject({ capacity: 5, confirmed: 2, held: 0, available: 3 })
    const search = await searchCourses({})
    expect(search.results.find((r) => r.intakeId === intake.id)?.available).toBe(3)
  })

  it('snapshots the school’s commission on marketplace bookings only', async () => {
    const admin = await createUser('PLATFORM_ADMIN')
    const { school, courseType, owner } = await createSchool()
    await setCommissionTerms(admin, school.id, { type: 'FIXED', fixedCents: 8_000 })
    const intake = await createIntake(courseType.id, school.id, { capacity: 5 })

    const { booking } = await holdAndPay(intake.id)
    const { booking: direct } = await createDirectEnrolment(owner, intake.id, { studentName: 'Dana Direct', studentEmail: 'd@example.test', sendConfirmation: false })

    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).commissionCents).toBe(8_000)
    expect(direct.commissionCents).toBe(0)
  })
})

describe('the last seat is never sold twice', () => {
  it('lets exactly one of many simultaneous students hold the last seat', async () => {
    const { school, courseType } = await createSchool()
    const intake = await createIntake(courseType.id, school.id, { capacity: 1 })
    const students = await Promise.all(Array.from({ length: 20 }, () => createStudent()))

    const results = await Promise.allSettled(students.map((s) => createSeatHold(s.actor, intake.id, s.details)))

    const won = results.filter((r) => r.status === 'fulfilled')
    const lost = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    expect(won).toHaveLength(1)
    expect(lost.every((r) => r.reason instanceof AppError && r.reason.code === 'NO_SEATS')).toBe(true)
    expect((await countSeats(prisma, intake.id)).taken).toBe(1)
  })

  it('never exceeds capacity when marketplace holds and direct enrolments race', async () => {
    const { school, courseType, owner } = await createSchool()
    const intake = await createIntake(courseType.id, school.id, { capacity: 3 })
    const students = await Promise.all(Array.from({ length: 10 }, () => createStudent()))

    const attempts = [
      ...students.map((s) => createSeatHold(s.actor, intake.id, s.details)),
      ...Array.from({ length: 10 }, (_, i) =>
        createDirectEnrolment(owner, intake.id, { studentName: `Walk-in ${i}`, studentEmail: `walkin${i}@example.test`, sendConfirmation: false })
      ),
    ]
    const results = await Promise.allSettled(attempts)

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3)
    expect((await countSeats(prisma, intake.id)).taken).toBe(3)
  })

  it('refunds the second payer when a lapsed hold loses its seat to someone else', async () => {
    const { school, courseType } = await createSchool()
    const intake = await createIntake(courseType.id, school.id, { capacity: 1 })
    const slow = await createStudent()
    const t0 = new Date()
    const slowBooking = await createSeatHold(slow.actor, intake.id, slow.details, t0)
    await startCardCheckout(slow.actor, slowBooking.id, 'de', t0)

    // The hold lapses; another student takes and pays for the seat.
    const later = new Date(t0.getTime() + 20 * MINUTE)
    const fast = await createStudent()
    const fastBooking = await createSeatHold(fast.actor, intake.id, fast.details, later)
    await startCardCheckout(fast.actor, fastBooking.id, 'de', later)
    const fastPaid = await handlePaymentEvent(completedEvent(await prisma.booking.findUniqueOrThrow({ where: { id: fastBooking.id } })), later)
    expect(fastPaid.status).toBe('confirmed')

    // The first student's payment finally arrives.
    const slowSession = await prisma.booking.findUniqueOrThrow({ where: { id: slowBooking.id } })
    const lateResult = await handlePaymentEvent(completedEvent(slowSession), new Date(later.getTime() + MINUTE))

    expect(lateResult.status).toBe('refunded')
    expect(await prisma.booking.count({ where: { intakeId: intake.id, status: 'CONFIRMED' } })).toBe(1)
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: slowBooking.id } })).status).toBe('FAILED_REFUNDED')
  })
})

describe('duplicate payment notifications', () => {
  it('handles a redelivered event once', async () => {
    const { school, courseType } = await createSchool()
    const intake = await createIntake(courseType.id, school.id)
    const { actor, details } = await createStudent()
    const hold = await createSeatHold(actor, intake.id, details)
    await startCardCheckout(actor, hold.id, 'de')
    const event = completedEvent(await prisma.booking.findUniqueOrThrow({ where: { id: hold.id } }))

    const first = await handlePaymentEvent(event)
    const second = await handlePaymentEvent(event)

    expect(first.status).toBe('confirmed')
    expect(second.status).toBe('duplicate')
    expect(await prisma.payment.count({ where: { bookingId: hold.id } })).toBe(1)
    expect(await prisma.booking.count({ where: { studentUserId: actor.userId } })).toBe(1)
    expect(MockEmailService.outbox.filter((m) => m.to === details.email)).toHaveLength(1)
  })

  it('handles simultaneous deliveries and different events about the same payment once', async () => {
    const { school, courseType } = await createSchool()
    const intake = await createIntake(courseType.id, school.id)
    const { actor, details } = await createStudent()
    const hold = await createSeatHold(actor, intake.id, details)
    await startCardCheckout(actor, hold.id, 'de')
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: hold.id } })
    const event = completedEvent(booking, { paymentId: 'pi_same' })

    const results = await Promise.all([
      handlePaymentEvent(event),
      handlePaymentEvent(event),
      handlePaymentEvent({ ...event, eventId: 'evt_other_type_same_payment' }),
    ])

    expect(results.filter((r) => r.status === 'confirmed')).toHaveLength(1)
    expect(await prisma.payment.count()).toBe(1)
    expect(await prisma.booking.count({ where: { status: 'CONFIRMED' } })).toBe(1)
    expect(mockPayments().refunds).toHaveLength(0)
  })
})

describe('holds expire', () => {
  it('releases the seat when checkout is abandoned', async () => {
    const { school, courseType } = await createSchool()
    const intake = await createIntake(courseType.id, school.id, { capacity: 1 })
    const first = await createStudent()
    const t0 = new Date()
    const hold = await createSeatHold(first.actor, intake.id, first.details, t0)

    const second = await createStudent()
    await expectCode(createSeatHold(second.actor, intake.id, second.details, new Date(t0.getTime() + 5 * MINUTE)), 'NO_SEATS')

    // After the hold period the seat is free again, even before the cleanup job runs.
    const later = new Date(t0.getTime() + 16 * MINUTE)
    expect((await countSeats(prisma, intake.id, later)).taken).toBe(0)
    await expect(createSeatHold(second.actor, intake.id, second.details, later)).resolves.toBeTruthy()

    expect((await prisma.booking.findUniqueOrThrow({ where: { id: hold.id } })).status).toBe('EXPIRED')
  })

  it('the cleanup job expires lapsed holds and their checkout sessions', async () => {
    const { school, courseType } = await createSchool()
    const intake = await createIntake(courseType.id, school.id)
    const { actor, details } = await createStudent()
    const t0 = new Date(Date.now() - 20 * MINUTE)
    const hold = await createSeatHold(actor, intake.id, details, t0)
    const session = await startCardCheckout(actor, hold.id, 'de', t0)

    expect(await expireStaleHolds()).toBe(1)
    expect((await prisma.seatHold.findUniqueOrThrow({ where: { bookingId: hold.id } })).status).toBe('EXPIRED')
    expect(mockPayments().sessions.get(session.id)?.status).toBe('expired')
  })

  it('confirms a late payment when a seat is still free', async () => {
    const { school, courseType } = await createSchool()
    const intake = await createIntake(courseType.id, school.id, { capacity: 2 })
    const { actor, details } = await createStudent()
    const t0 = new Date()
    const hold = await createSeatHold(actor, intake.id, details, t0)
    await startCardCheckout(actor, hold.id, 'de', t0)
    const result = await handlePaymentEvent(
      completedEvent(await prisma.booking.findUniqueOrThrow({ where: { id: hold.id } })),
      new Date(t0.getTime() + 25 * MINUTE)
    )
    expect(result.status).toBe('confirmed')
  })
})

describe('a student is never charged for a seat they did not get', () => {
  it('refunds in full when the school pauses the intake during checkout', async () => {
    const { school, courseType, owner } = await createSchool()
    const intake = await createIntake(courseType.id, school.id)
    const { actor, details } = await createStudent()
    const hold = await createSeatHold(actor, intake.id, details)
    await startCardCheckout(actor, hold.id, 'de')
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: hold.id } })

    await setIntakeStatus(owner, intake.id, 'PAUSED')
    const result = await handlePaymentEvent(completedEvent(booking))

    expect(result.status).toBe('refunded')
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: hold.id }, include: { refunds: true, payments: true } })
    expect(after.status).toBe('FAILED_REFUNDED')
    expect(after.refunds[0]).toMatchObject({ status: 'SUCCEEDED', amountCents: booking.totalCents })
    expect(after.payments[0].status).toBe('REFUNDED')
    expect(mockPayments().refunds).toHaveLength(1)
    expect(MockEmailService.outbox.some((m) => m.to === details.email && /refund|erstattet/i.test(m.subject))).toBe(true)
  })

  it('refunds when the amount paid does not match the booking', async () => {
    const { school, courseType } = await createSchool()
    const intake = await createIntake(courseType.id, school.id)
    const { actor, details } = await createStudent()
    const hold = await createSeatHold(actor, intake.id, details)
    await startCardCheckout(actor, hold.id, 'de')
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: hold.id } })

    const result = await handlePaymentEvent(completedEvent(booking, { amountCents: 100 }))
    expect(result.status).toBe('refunded')
    expect((await countSeats(prisma, intake.id)).taken).toBe(0)
  })

  it('keeps the refund pending for retry if the provider call fails', async () => {
    const { school, courseType, owner } = await createSchool()
    const intake = await createIntake(courseType.id, school.id)
    const { actor, details } = await createStudent()
    const hold = await createSeatHold(actor, intake.id, details)
    await startCardCheckout(actor, hold.id, 'de')
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: hold.id } })
    await setIntakeStatus(owner, intake.id, 'CLOSED')

    mockPayments().failRefunds = true
    await handlePaymentEvent(completedEvent(booking))
    expect((await prisma.refund.findFirstOrThrow({ where: { bookingId: booking.id } })).status).toBe('FAILED')

    mockPayments().failRefunds = false
    const { retryPendingRefunds } = await import('@/lib/booking/inventory')
    await retryPendingRefunds()
    expect((await prisma.refund.findFirstOrThrow({ where: { bookingId: booking.id } })).status).toBe('SUCCEEDED')
  })
})

describe('shared seat inventory', () => {
  it('a direct enrolment removes the seat from the marketplace immediately', async () => {
    const { school, courseType, owner } = await createSchool()
    const intake = await createIntake(courseType.id, school.id, { capacity: 1 })

    const before = await searchCourses({})
    expect(before.results.find((r) => r.intakeId === intake.id)?.mode).toBe('INSTANT')

    await createDirectEnrolment(owner, intake.id, { studentName: 'Walk In', studentEmail: 'walkin@example.test', sendConfirmation: false })

    const after = await searchCourses({})
    expect(after.results.find((r) => r.intakeId === intake.id)).toMatchObject({ mode: 'UNAVAILABLE', reason: 'FULL', available: 0 })
    const { actor, details } = await createStudent()
    await expectCode(createSeatHold(actor, intake.id, details), 'NO_SEATS')
  })

  it('capacity can never be set below the seats already taken', async () => {
    const { school, courseType, owner } = await createSchool()
    const intake = await createIntake(courseType.id, school.id, { capacity: 3 })
    await createDirectEnrolment(owner, intake.id, { studentName: 'Anna A', studentEmail: 'a@example.test', sendConfirmation: false })
    await createDirectEnrolment(owner, intake.id, { studentName: 'Ben B', studentEmail: 'b@example.test', sendConfirmation: false })

    const base = {
      startDate: intake.startDate.toISOString().slice(0, 10),
      endDate: intake.endDate.toISOString().slice(0, 10),
      weekdays: [1, 3],
      startTime: '18:00',
      endTime: '20:15',
      priceCents: 39_900,
    }
    await expectCode(updateIntake(owner, intake.id, { ...base, capacity: 1 }), 'CONFLICT')
    await expect(updateIntake(owner, intake.id, { ...base, capacity: 2 })).resolves.toBeTruthy()
    expect(await prisma.auditEvent.count({ where: { entityId: intake.id, action: 'intake.capacity_changed' } })).toBe(1)
  })

  it('cancelling frees the seat and refunds the card payment', async () => {
    const { school, courseType, owner } = await createSchool()
    const intake = await createIntake(courseType.id, school.id, { capacity: 1 })
    const { booking } = await holdAndPay(intake.id)

    await cancelBookingAsSchool(owner, booking.id, { reason: 'Student moved away', refundCents: booking.totalCents })

    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CANCELLED')
    expect((await countSeats(prisma, intake.id)).taken).toBe(0)
    expect(mockPayments().refunds[0].amountCents).toBe(booking.totalCents)
    expect(await prisma.auditEvent.count({ where: { entityId: booking.id, action: 'booking.cancelled' } })).toBe(1)
  })

  it('transferring moves the seat and the payments to the new intake', async () => {
    const { school, courseType, owner } = await createSchool()
    const october = await createIntake(courseType.id, school.id, { capacity: 1, startInDays: 20 })
    const november = await createIntake(courseType.id, school.id, { capacity: 1, startInDays: 50 })
    const { booking } = await holdAndPay(october.id)

    const newId = await transferBooking(owner, booking.id, november.id, 'Schedule conflict')

    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('TRANSFERRED')
    const moved = await prisma.booking.findUniqueOrThrow({ where: { id: newId }, include: { payments: true } })
    expect(moved).toMatchObject({ status: 'CONFIRMED', intakeId: november.id, transferredFromId: booking.id })
    expect(moved.payments).toHaveLength(1)
    expect((await countSeats(prisma, october.id)).taken).toBe(0)
    expect((await countSeats(prisma, november.id)).taken).toBe(1)
  })
})

describe('schools that have not agreed to participate never get instant bookings', () => {
  it('a verified (non-partner) school shows as enquiry-only and refuses checkout', async () => {
    const { school, courseType } = await createSchool({ status: 'VERIFIED' })
    const intake = await createIntake(courseType.id, school.id)

    const search = await searchCourses({})
    expect(search.results.find((r) => r.intakeId === intake.id)?.mode).toBe('ENQUIRY')

    const { actor, details } = await createStudent()
    await expectCode(createSeatHold(actor, intake.id, details), 'NOT_PARTNER')
  })

  it('the database rejects instant booking for a non-partner school', async () => {
    const { school } = await createSchool({ status: 'VERIFIED' })
    await expect(prisma.school.update({ where: { id: school.id }, data: { instantBookingEnabled: true } })).rejects.toThrow(/schools_instant_booking_requires_partner/)
  })

  it('the payment webhook refuses a booking if the school stopped taking instant bookings mid-checkout', async () => {
    const { school, courseType } = await createSchool()
    const intake = await createIntake(courseType.id, school.id)
    const { actor, details } = await createStudent()
    const hold = await createSeatHold(actor, intake.id, details)
    await startCardCheckout(actor, hold.id, 'de')
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: hold.id } })

    await prisma.school.update({ where: { id: school.id }, data: { status: 'VERIFIED', instantBookingEnabled: false } })
    const result = await handlePaymentEvent(completedEvent(booking))

    expect(result.status).toBe('refunded')
    expect(await prisma.booking.count({ where: { schoolId: school.id, status: 'CONFIRMED' } })).toBe(0)
  })

  it('checkout refuses a partner school that has switched instant booking off', async () => {
    const { school, courseType } = await createSchool({ instantBooking: false })
    const intake = await createIntake(courseType.id, school.id)
    const { actor, details } = await createStudent()
    await expectCode(createSeatHold(actor, intake.id, details), 'NOT_PARTNER')
    expect((await searchCourses({})).results.find((r) => r.intakeId === intake.id)?.mode).toBe('ENQUIRY')
  })

  it('pay-at-school is only possible where the school enabled it', async () => {
    const plain = await createSchool()
    const plainIntake = await createIntake(plain.courseType.id, plain.school.id)
    const s1 = await createStudent()
    const h1 = await createSeatHold(s1.actor, plainIntake.id, s1.details)
    await expectCode(confirmPayAtSchool(s1.actor, h1.id), 'FORBIDDEN')

    const flexible = await createSchool({ payAtSchool: true })
    const flexIntake = await createIntake(flexible.courseType.id, flexible.school.id)
    const s2 = await createStudent()
    const h2 = await createSeatHold(s2.actor, flexIntake.id, s2.details)
    await confirmPayAtSchool(s2.actor, h2.id)
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: h2.id } })).status).toBe('CONFIRMED')
  })
})

describe('school data isolation', () => {
  it('staff of school A cannot read or change school B’s intakes and bookings', async () => {
    const a = await createSchool()
    const b = await createSchool()
    const intakeA = await createIntake(a.courseType.id, a.school.id)
    const intakeB = await createIntake(b.courseType.id, b.school.id)
    const { booking: bookingB } = await holdAndPay(intakeB.id)

    const actorA = a.owner
    const base = { startDate: '2030-01-07', endDate: '2030-03-01', weekdays: [1], startTime: '09:00', endTime: '12:00', priceCents: 1, capacity: 99 }

    await expectCode(createDirectEnrolment(actorA, intakeB.id, { studentName: 'Xavier X', studentEmail: 'x@example.test' }), 'NOT_FOUND')
    await expectCode(updateIntake(actorA, intakeB.id, base), 'NOT_FOUND')
    await expectCode(setIntakeStatus(actorA, intakeB.id, 'CLOSED'), 'NOT_FOUND')
    await expectCode(cancelBookingAsSchool(actorA, bookingB.id, { reason: 'nope' }), 'NOT_FOUND')
    await expectCode(recordPayment(actorA, bookingB.id, { amountCents: 100, method: 'CASH' }), 'NOT_FOUND')
    await expectCode(transferBooking(actorA, bookingB.id, intakeA.id, 'steal'), 'NOT_FOUND')

    const intakeBAfter = await prisma.intake.findUniqueOrThrow({ where: { id: intakeB.id } })
    expect(intakeBAfter).toMatchObject({ status: 'OPEN', capacity: intakeB.capacity, priceCents: intakeB.priceCents })
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingB.id } })).status).toBe('CONFIRMED')
  })

  it('staff permissions are enforced', async () => {
    const { school, courseType, owner } = await createSchool()
    const intake = await createIntake(courseType.id, school.id)
    const coursesOnly = staffActor(owner, { manageCourses: true })
    await expectCode(createDirectEnrolment(coursesOnly, intake.id, { studentName: 'Xavier X', studentEmail: 'x@example.test' }), 'FORBIDDEN')
    const bookingsOnly = staffActor(owner, { manageBookings: true })
    await expectCode(setIntakeStatus(bookingsOnly, intake.id, 'PAUSED'), 'FORBIDDEN')
  })
})
