import { z } from 'zod'
import { prisma } from '../prisma'
import { audit } from '../audit'
import { AppError } from '../errors'
import { assertPermission, assertPlatformAdmin, assertSameSchool, type Actor, type SchoolActor } from '../permissions'
import * as notify from '../notify'

export const enquirySchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  message: z.string().trim().min(10).max(3000),
})

/** A question about a course. It never reserves a place. */
export async function createEnquiry(intakeId: string, input: z.input<typeof enquirySchema>, actor?: Actor | null) {
  const data = enquirySchema.parse(input)
  const intake = await prisma.intake.findUnique({
    where: { id: intakeId },
    include: { school: { select: { status: true } }, courseType: { select: { publicationStatus: true } } },
  })
  if (!intake || intake.courseType.publicationStatus !== 'PUBLISHED' || !['VERIFIED', 'PARTNER'].includes(intake.school.status)) {
    throw new AppError('NOT_FOUND')
  }
  const enquiry = await prisma.enquiry.create({
    data: {
      schoolId: intake.schoolId,
      courseTypeId: intake.courseTypeId,
      intakeId,
      userId: actor?.userId,
      ...data,
    },
  })
  await notify.enquiryReceived(enquiry.id)
  return enquiry
}

export async function answerEnquiry(actor: SchoolActor, enquiryId: string, response: string) {
  assertPermission(actor, 'manageBookings')
  const text = z.string().trim().min(2).max(5000).parse(response)
  const enquiry = await prisma.enquiry.findUnique({ where: { id: enquiryId } })
  assertSameSchool(actor, enquiry)
  const updated = await prisma.enquiry.update({
    where: { id: enquiryId },
    data: { response: text, status: 'RESPONDED', respondedAt: enquiry.respondedAt ?? new Date(), respondedById: actor.userId },
  })
  await notify.enquiryAnswered(enquiryId)
  return updated
}

export async function closeEnquiry(actor: SchoolActor, enquiryId: string) {
  assertPermission(actor, 'manageBookings')
  const enquiry = await prisma.enquiry.findUnique({ where: { id: enquiryId } })
  assertSameSchool(actor, enquiry)
  return prisma.enquiry.update({ where: { id: enquiryId }, data: { status: 'CLOSED' } })
}

// ---------------------------------------------------------------------------
// Support requests (handled by the internal team)
// ---------------------------------------------------------------------------

export const supportRequestSchema = z.object({
  type: z.enum(['GENERAL', 'CANCELLATION', 'REFUND', 'BOOKING_PROBLEM', 'SCHOOL_DATA']).default('GENERAL'),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
  email: z.string().trim().toLowerCase().email(),
  bookingId: z.string().optional(),
})

export async function createSupportRequest(input: z.input<typeof supportRequestSchema>, actor?: Actor | null) {
  const data = supportRequestSchema.parse(input)
  let schoolId: string | undefined
  if (data.bookingId) {
    const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } })
    if (!booking || (actor && booking.studentUserId !== actor.userId && actor.role !== 'PLATFORM_ADMIN')) {
      throw new AppError('NOT_FOUND')
    }
    schoolId = booking.schoolId
  }
  return prisma.supportRequest.create({ data: { ...data, requesterId: actor?.userId, schoolId } })
}

export async function updateSupportRequest(
  actor: Actor,
  id: string,
  input: { status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; resolution?: string; assignToMe?: boolean }
) {
  assertPlatformAdmin(actor)
  const request = await prisma.supportRequest.findUnique({ where: { id } })
  if (!request) throw new AppError('NOT_FOUND')
  const updated = await prisma.supportRequest.update({
    where: { id },
    data: {
      status: input.status,
      resolution: input.resolution?.trim() || request.resolution,
      resolvedAt: input.status === 'RESOLVED' ? request.resolvedAt ?? new Date() : null,
      assigneeId: input.assignToMe ? actor.userId : request.assigneeId,
    },
  })
  await audit(prisma, {
    actorId: actor.userId,
    schoolId: request.schoolId,
    entity: 'SupportRequest',
    entityId: id,
    action: 'support.updated',
    before: { status: request.status },
    after: { status: input.status },
  })
  return updated
}
