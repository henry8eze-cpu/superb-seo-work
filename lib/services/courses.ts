// School app: branches, course types and dated intakes.

import type { IntakeStatus, Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { audit, diff } from '../audit'
import { AppError } from '../errors'
import { assertPermission, assertPlatformAdmin, assertSameSchool, type Actor, type SchoolActor } from '../permissions'
import { locateBranch } from '../geo'
import { normalizeDomain, normalizePhone, normalizePostcode, normalizeUrl } from '../schools/normalize'
import { branchSchema, type BranchInput } from '../validation/schools'
import { courseTypeSchema, intakeSchema, schoolProfileSchema, type CourseTypeInput, type IntakeInput } from '../validation/courses'
import { parseBerlinDateTime, parseDay } from '../dates'
import { countSeats, lockIntake, releaseHoldsForIntake, TX_OPTIONS } from '../booking/inventory'
import { totalPrice } from '../booking/rules'
import { getPaymentProvider } from '../payments'

// ---------------------------------------------------------------------------
// School profile
// ---------------------------------------------------------------------------

export async function updateSchoolProfile(actor: SchoolActor, input: unknown) {
  assertPermission(actor, 'manageCourses')
  const data = schoolProfileSchema.parse(input)
  return prisma.$transaction(async (tx) => {
    const school = await tx.school.findUniqueOrThrow({ where: { id: actor.schoolId } })
    const next = {
      description: data.description ?? null,
      website: normalizeUrl(data.website),
      websiteDomain: normalizeDomain(data.website),
      publicEmail: data.publicEmail?.toLowerCase() ?? null,
      phone: data.phone ?? null,
      phoneNormalized: normalizePhone(data.phone),
    }
    const changes = diff(school as unknown as Record<string, unknown>, next)
    if (!changes.changed) return school
    const updated = await tx.school.update({ where: { id: actor.schoolId }, data: next })
    await audit(tx, { actorId: actor.userId, schoolId: actor.schoolId, entity: 'School', entityId: actor.schoolId, action: 'school.profile_updated', ...changes })
    return updated
  })
}

/**
 * Only the owner can switch instant booking on, and only for a registered partner.
 * The database CHECK constraint enforces the partner rule as well.
 */
export async function setInstantBooking(actor: SchoolActor, enabled: boolean, agreesToMaintainCapacity: boolean) {
  if (actor.schoolRole !== 'OWNER' && actor.schoolRole !== 'PLATFORM_ADMIN') throw new AppError('FORBIDDEN')
  if (enabled && !agreesToMaintainCapacity) throw new AppError('VALIDATION', 'Confirm that you will keep seat numbers up to date')
  return prisma.$transaction(async (tx) => {
    const school = await tx.school.findUniqueOrThrow({ where: { id: actor.schoolId } })
    if (enabled && school.status !== 'PARTNER') throw new AppError('NOT_PARTNER')
    const updated = await tx.school.update({ where: { id: actor.schoolId }, data: { instantBookingEnabled: enabled } })
    await audit(tx, {
      actorId: actor.userId,
      schoolId: actor.schoolId,
      entity: 'School',
      entityId: actor.schoolId,
      action: enabled ? 'school.instant_booking_enabled' : 'school.instant_booking_disabled',
      before: { instantBookingEnabled: school.instantBookingEnabled },
      after: { instantBookingEnabled: enabled },
    })
    return updated
  })
}

export async function setPayAtSchool(actor: SchoolActor, enabled: boolean) {
  if (actor.schoolRole !== 'OWNER' && actor.schoolRole !== 'PLATFORM_ADMIN') throw new AppError('FORBIDDEN')
  return prisma.$transaction(async (tx) => {
    const updated = await tx.school.update({ where: { id: actor.schoolId }, data: { allowPayAtSchool: enabled } })
    await audit(tx, {
      actorId: actor.userId,
      schoolId: actor.schoolId,
      entity: 'School',
      entityId: actor.schoolId,
      action: 'school.pay_at_school_changed',
      after: { allowPayAtSchool: enabled },
    })
    return updated
  })
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

async function branchData(input: BranchInput) {
  const data = branchSchema.parse(input)
  const location = data.isOnline ? { cityId: null, lat: null, lng: null } : await locateBranch(data)
  if (!data.isOnline && (!data.postcode || !data.cityName)) throw new AppError('VALIDATION', 'Postcode and city are required for in-person branches')
  if (!data.isOnline && !/^\d{5}$/.test(data.postcode!.trim())) throw new AppError('VALIDATION', 'A German postcode has 5 digits')
  return {
    name: data.name,
    isOnline: data.isOnline,
    address: data.isOnline ? null : data.address ?? null,
    postcode: data.isOnline ? null : normalizePostcode(data.postcode),
    cityName: data.isOnline ? null : data.cityName ?? null,
    phone: data.phone ?? null,
    ...location,
  }
}

export async function createBranch(actor: SchoolActor, input: BranchInput) {
  assertPermission(actor, 'manageCourses')
  const data = await branchData(input)
  const branch = await prisma.branch.create({ data: { schoolId: actor.schoolId, ...data } })
  await audit(prisma, { actorId: actor.userId, schoolId: actor.schoolId, entity: 'Branch', entityId: branch.id, action: 'branch.created', after: data })
  return branch
}

export async function updateBranch(actor: SchoolActor, branchId: string, input: BranchInput) {
  assertPermission(actor, 'manageCourses')
  const branch = await prisma.branch.findUnique({ where: { id: branchId } })
  assertSameSchool(actor, branch)
  const data = await branchData(input)
  const changes = diff(branch as unknown as Record<string, unknown>, data)
  const updated = await prisma.branch.update({ where: { id: branchId }, data })
  if (changes.changed) {
    await audit(prisma, { actorId: actor.userId, schoolId: actor.schoolId, entity: 'Branch', entityId: branchId, action: 'branch.updated', ...changes })
  }
  return updated
}

export async function archiveBranch(actor: SchoolActor, branchId: string) {
  assertPermission(actor, 'manageCourses')
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { courseTypes: { where: { publicationStatus: { in: ['PUBLISHED', 'PENDING_APPROVAL'] } }, select: { id: true } } },
  })
  assertSameSchool(actor, branch)
  if (branch.courseTypes.length > 0) throw new AppError('CONFLICT', 'Archive or move the courses at this branch first')
  await prisma.branch.update({ where: { id: branchId }, data: { archivedAt: new Date() } })
  await audit(prisma, { actorId: actor.userId, schoolId: actor.schoolId, entity: 'Branch', entityId: branchId, action: 'branch.archived' })
}

// ---------------------------------------------------------------------------
// Course types
// ---------------------------------------------------------------------------

async function assertBranch(actor: SchoolActor, branchId: string) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } })
  assertSameSchool(actor, branch)
  if (branch.archivedAt) throw new AppError('VALIDATION', 'This branch is archived')
  return branch
}

export async function createCourseType(actor: SchoolActor, input: CourseTypeInput) {
  assertPermission(actor, 'manageCourses')
  const data = courseTypeSchema.parse(input)
  await assertBranch(actor, data.branchId)
  const language = await prisma.language.findUnique({ where: { code: data.languageCode } })
  if (!language?.active) throw new AppError('VALIDATION', 'Unsupported language')
  const courseType = await prisma.courseType.create({ data: { schoolId: actor.schoolId, ...data } })
  await audit(prisma, { actorId: actor.userId, schoolId: actor.schoolId, entity: 'CourseType', entityId: courseType.id, action: 'course.created', after: data })
  return courseType
}

export async function updateCourseType(actor: SchoolActor, courseTypeId: string, input: CourseTypeInput) {
  assertPermission(actor, 'manageCourses')
  const data = courseTypeSchema.parse(input)
  const courseType = await prisma.courseType.findUnique({ where: { id: courseTypeId } })
  assertSameSchool(actor, courseType)
  await assertBranch(actor, data.branchId)
  const changes = diff(courseType as unknown as Record<string, unknown>, data)
  if (!changes.changed) return courseType
  const updated = await prisma.courseType.update({ where: { id: courseTypeId }, data })
  await audit(prisma, { actorId: actor.userId, schoolId: actor.schoolId, entity: 'CourseType', entityId: courseTypeId, action: 'course.updated', ...changes })
  return updated
}

/**
 * Sends a course to our team for approval. Courses a platform admin enters on a
 * school's behalf (support mode) are published straight away.
 */
export async function submitCourseType(actor: SchoolActor, courseTypeId: string) {
  assertPermission(actor, 'manageCourses')
  const courseType = await prisma.courseType.findUnique({ where: { id: courseTypeId }, include: { _count: { select: { intakes: true } } } })
  assertSameSchool(actor, courseType)
  if (!['DRAFT', 'REJECTED'].includes(courseType.publicationStatus)) throw new AppError('CONFLICT')
  if (courseType._count.intakes === 0) throw new AppError('VALIDATION', 'Add at least one dated intake first')
  const now = new Date()
  const publishDirectly = actor.schoolRole === 'PLATFORM_ADMIN'
  const updated = await prisma.courseType.update({
    where: { id: courseTypeId },
    data: publishDirectly
      ? { publicationStatus: 'PUBLISHED', submittedAt: now, reviewedAt: now, reviewedById: actor.userId, rejectionReason: null }
      : { publicationStatus: 'PENDING_APPROVAL', submittedAt: now, rejectionReason: null },
  })
  await audit(prisma, {
    actorId: actor.userId,
    schoolId: actor.schoolId,
    entity: 'CourseType',
    entityId: courseTypeId,
    action: publishDirectly ? 'course.published' : 'course.submitted',
    before: { publicationStatus: courseType.publicationStatus },
    after: { publicationStatus: updated.publicationStatus },
  })
  return updated
}

export async function archiveCourseType(actor: SchoolActor, courseTypeId: string) {
  assertPermission(actor, 'manageCourses')
  const courseType = await prisma.courseType.findUnique({ where: { id: courseTypeId } })
  assertSameSchool(actor, courseType)
  await prisma.$transaction(async (tx) => {
    await tx.courseType.update({ where: { id: courseTypeId }, data: { publicationStatus: 'ARCHIVED' } })
    const open = await tx.intake.findMany({ where: { courseTypeId, status: { in: ['OPEN', 'PAUSED', 'FULL'] } }, select: { id: true } })
    for (const intake of open) {
      await lockIntake(tx, intake.id)
      await releaseHoldsForIntake(tx, intake.id, new Date())
      await tx.intake.update({ where: { id: intake.id }, data: { status: 'CLOSED' } })
    }
    await audit(tx, {
      actorId: actor.userId,
      schoolId: actor.schoolId,
      entity: 'CourseType',
      entityId: courseTypeId,
      action: 'course.archived',
      before: { publicationStatus: courseType.publicationStatus },
      after: { publicationStatus: 'ARCHIVED', intakesClosed: open.length },
    })
  }, TX_OPTIONS)
}

export async function reviewCourseType(actor: Actor, courseTypeId: string, decision: 'approve' | 'reject', reason?: string) {
  assertPlatformAdmin(actor)
  if (decision === 'reject' && !reason?.trim()) throw new AppError('VALIDATION', 'Give the school a reason')
  return prisma.$transaction(async (tx) => {
    const courseType = await tx.courseType.findUnique({ where: { id: courseTypeId } })
    if (!courseType) throw new AppError('NOT_FOUND')
    if (courseType.publicationStatus !== 'PENDING_APPROVAL') throw new AppError('CONFLICT')
    const updated = await tx.courseType.update({
      where: { id: courseTypeId },
      data: {
        publicationStatus: decision === 'approve' ? 'PUBLISHED' : 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: actor.userId,
        rejectionReason: decision === 'reject' ? reason!.trim() : null,
      },
    })
    await audit(tx, {
      actorId: actor.userId,
      schoolId: courseType.schoolId,
      entity: 'CourseType',
      entityId: courseTypeId,
      action: decision === 'approve' ? 'course.approved' : 'course.rejected',
      before: { publicationStatus: courseType.publicationStatus },
      after: { publicationStatus: updated.publicationStatus, reason },
    })
    await tx.notification.create({
      data: {
        schoolId: courseType.schoolId,
        type: decision === 'approve' ? 'course.approved' : 'course.rejected',
        title: decision === 'approve' ? `Kurs veröffentlicht: ${courseType.name}` : `Kurs abgelehnt: ${courseType.name}`,
        body: reason ?? null,
        link: `/school/courses/${courseTypeId}`,
      },
    })
    return updated
  })
}

// ---------------------------------------------------------------------------
// Intakes
// ---------------------------------------------------------------------------

function intakeData(input: IntakeInput) {
  const data = intakeSchema.parse(input)
  return {
    data,
    fields: {
      startDate: parseDay(data.startDate),
      endDate: parseDay(data.endDate),
      weekdays: [...new Set(data.weekdays)].sort(),
      startTime: data.startTime,
      endTime: data.endTime,
      priceCents: data.priceCents,
      totalPriceCents: totalPrice(data.priceCents, data.fees),
      capacity: data.capacity,
      bookingDeadline: data.bookingDeadline ? parseBerlinDateTime(data.bookingDeadline) : null,
      instantBooking: data.instantBooking,
    },
  }
}

export async function createIntake(actor: SchoolActor, courseTypeId: string, input: IntakeInput) {
  assertPermission(actor, 'manageCourses')
  const courseType = await prisma.courseType.findUnique({ where: { id: courseTypeId } })
  assertSameSchool(actor, courseType)
  if (courseType.publicationStatus === 'ARCHIVED') throw new AppError('CONFLICT')
  const { data, fields } = intakeData(input)
  return prisma.$transaction(async (tx) => {
    const intake = await tx.intake.create({
      data: {
        ...fields,
        courseTypeId,
        schoolId: actor.schoolId,
        lastConfirmedAt: new Date(),
        lastConfirmedById: actor.userId,
        fees: { create: data.fees },
      },
    })
    await audit(tx, {
      actorId: actor.userId,
      schoolId: actor.schoolId,
      entity: 'Intake',
      entityId: intake.id,
      action: 'intake.created',
      after: { ...fields, fees: data.fees },
    })
    return intake
  })
}

/**
 * Updates schedule, price, fees and capacity. Capacity can never drop below the
 * seats already sold or held. Saving counts as the school confirming the information.
 */
export async function updateIntake(actor: SchoolActor, intakeId: string, input: IntakeInput, now = new Date()) {
  assertPermission(actor, 'manageCourses')
  const { data, fields } = intakeData(input)
  return prisma.$transaction(async (tx) => {
    const intake = await lockIntake(tx, intakeId)
    assertSameSchool(actor, intake)
    const seats = await countSeats(tx, intakeId, now)
    if (fields.capacity < seats.taken) {
      throw new AppError('CONFLICT', `Capacity cannot be lower than the ${seats.taken} seats already taken`, { taken: seats.taken })
    }
    const before = {
      ...Object.fromEntries(Object.keys(fields).map((k) => [k, (intake as Record<string, unknown>)[k]])),
      fees: intake.fees.map((f) => ({ label: f.label, amountCents: f.amountCents, compulsory: f.compulsory })),
    }
    const changes = diff(before, { ...fields, fees: data.fees })
    await tx.intakeFee.deleteMany({ where: { intakeId } })
    const updated = await tx.intake.update({
      where: { id: intakeId },
      data: {
        ...fields,
        // A school that fills up its last seat and then adds capacity reopens the intake.
        status: intake.status === 'FULL' && fields.capacity > seats.taken ? 'OPEN' : intake.status,
        lastConfirmedAt: now,
        lastConfirmedById: actor.userId,
        fees: { create: data.fees },
      },
    })
    if (changes.changed) {
      const priceChanged = 'priceCents' in changes.after || 'fees' in changes.after
      const capacityChanged = 'capacity' in changes.after
      await audit(tx, {
        actorId: actor.userId,
        schoolId: actor.schoolId,
        entity: 'Intake',
        entityId: intakeId,
        action: priceChanged ? 'intake.price_changed' : capacityChanged ? 'intake.capacity_changed' : 'intake.updated',
        before: changes.before,
        after: changes.after,
      })
    }
    return updated
  }, TX_OPTIONS)
}

/** Pause, close or reopen an intake. Takes effect immediately, including for anyone in checkout. */
export async function setIntakeStatus(actor: SchoolActor, intakeId: string, status: Extract<IntakeStatus, 'OPEN' | 'PAUSED' | 'CLOSED'>) {
  assertPermission(actor, 'manageCourses')
  const now = new Date()
  const sessionsToExpire = await prisma.$transaction(async (tx) => {
    const intake = await lockIntake(tx, intakeId)
    assertSameSchool(actor, intake)
    if (intake.status === status) return []
    const sessions = status === 'OPEN' ? [] : await releaseHoldsForIntake(tx, intakeId, now)
    await tx.intake.update({ where: { id: intakeId }, data: { status } })
    await audit(tx, {
      actorId: actor.userId,
      schoolId: actor.schoolId,
      entity: 'Intake',
      entityId: intakeId,
      action: 'intake.status_changed',
      before: { status: intake.status },
      after: { status, checkoutsReleased: sessions.length },
    })
    return sessions
  }, TX_OPTIONS)
  // Only contact the payment provider when someone was actually in checkout.
  if (sessionsToExpire.length > 0) {
    const provider = getPaymentProvider()
    for (const session of sessionsToExpire) await provider.expireCheckout(session)
  }
}

/** "This information is still correct" — refreshes the date shown to students. */
export async function confirmIntakeInformation(actor: SchoolActor, intakeIds: string[]) {
  assertPermission(actor, 'manageCourses')
  const intakes = await prisma.intake.findMany({ where: { id: { in: intakeIds } }, select: { id: true, schoolId: true } })
  for (const intake of intakes) assertSameSchool(actor, intake)
  const now = new Date()
  await prisma.intake.updateMany({
    where: { id: { in: intakes.map((i) => i.id) }, schoolId: actor.schoolId },
    data: { lastConfirmedAt: now, lastConfirmedById: actor.userId },
  })
  await prisma.auditEvent.createMany({
    data: intakes.map((i) => ({
      actorId: actor.userId,
      schoolId: actor.schoolId,
      entity: 'Intake',
      entityId: i.id,
      action: 'intake.information_confirmed',
    })),
  })
  return intakes.length
}

export async function archiveIntake(actor: SchoolActor, intakeId: string) {
  assertPermission(actor, 'manageCourses')
  await prisma.$transaction(async (tx) => {
    const intake = await lockIntake(tx, intakeId)
    assertSameSchool(actor, intake)
    const seats = await countSeats(tx, intakeId)
    if (seats.confirmed > 0) throw new AppError('CONFLICT', 'Cancel or transfer the booked students first')
    await releaseHoldsForIntake(tx, intakeId, new Date())
    await tx.intake.update({ where: { id: intakeId }, data: { archivedAt: new Date(), status: 'CLOSED' } })
    await audit(tx, { actorId: actor.userId, schoolId: actor.schoolId, entity: 'Intake', entityId: intakeId, action: 'intake.archived' })
  }, TX_OPTIONS)
}

export type IntakeWithRelations = Prisma.IntakeGetPayload<{ include: { courseType: { include: { branch: true } }; fees: true } }>
