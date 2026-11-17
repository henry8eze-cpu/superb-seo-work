'use server'

// Server actions for the school management app. The school is always taken
// from the signed-in user's membership, never from the request.

import { revalidatePublic as revalidatePath } from '@/lib/public-cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { run, str, optStr, bool, ints, cents, num } from '@/lib/action-result'
import { getSchoolActor, getActor, ACTIVE_SCHOOL_COOKIE } from '@/lib/session'
import { AppError } from '@/lib/errors'
import { setFlash } from '@/lib/flash'
import { prisma } from '@/lib/prisma'
import type { SchoolActor } from '@/lib/permissions'
import * as courses from '@/lib/services/courses'
import { courseTypeSchema, intakeSchema } from '@/lib/validation/courses'
import * as manage from '@/lib/booking/manage'
import { answerEnquiry, closeEnquiry } from '@/lib/services/enquiries'
import { inviteStaff, removeMembership, revokeInvitation, updateMembership, acceptStaffInvitation } from '@/lib/services/onboarding'

async function school(): Promise<SchoolActor> {
  const actor = await getSchoolActor()
  if (!actor) throw new AppError('FORBIDDEN')
  return actor
}

function refreshInventory(intakeId?: string) {
  // Seat counts are shown in the school app and on the marketplace.
  revalidatePath('/school', 'layout')
  revalidatePath('/courses', 'layout')
  if (intakeId) revalidatePath(`/courses/${intakeId}`)
}

export async function switchSchoolAction(form: FormData) {
  const actor = await getActor()
  if (!actor) redirect('/auth/login')
  const schoolId = str(form, 'schoolId')
  const member = await prisma.schoolMembership.findFirst({ where: { userId: actor.userId, schoolId, status: 'ACTIVE' } })
  if (member || actor.role === 'PLATFORM_ADMIN') {
    ;(await cookies()).set(ACTIVE_SCHOOL_COOKIE, schoolId, { path: '/', httpOnly: true, sameSite: 'lax' })
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } })
    if (school) await setFlash('info', 'schoolSwitched', { school: school.name })
  }
  redirect('/school')
}

export async function leaveSupportModeAction() {
  ;(await cookies()).delete(ACTIVE_SCHOOL_COOKIE)
  await setFlash('info', 'supportModeOff')
  redirect('/admin/schools')
}

// Profile ---------------------------------------------------------------------

export async function updateProfileAction(form: FormData) {
  return run(async () => {
    await courses.updateSchoolProfile(await school(), {
      description: optStr(form, 'description'),
      website: optStr(form, 'website'),
      publicEmail: optStr(form, 'publicEmail'),
      phone: optStr(form, 'phone'),
    })
    revalidatePath('/school/profile')
  })
}

export async function setInstantBookingAction(form: FormData) {
  return run(async () => {
    await courses.setInstantBooking(await school(), bool(form, 'enabled'), bool(form, 'agree'))
    refreshInventory()
  })
}

export async function setPayAtSchoolAction(form: FormData) {
  return run(async () => {
    await courses.setPayAtSchool(await school(), bool(form, 'enabled'))
    revalidatePath('/school/profile')
  })
}

// Branches ----------------------------------------------------------------------

function branchInput(form: FormData) {
  return {
    name: str(form, 'name'),
    isOnline: bool(form, 'isOnline'),
    address: optStr(form, 'address'),
    postcode: optStr(form, 'postcode'),
    cityName: optStr(form, 'cityName'),
    phone: optStr(form, 'phone'),
  }
}

export async function createBranchAction(form: FormData) {
  return run(async () => {
    await courses.createBranch(await school(), branchInput(form))
    revalidatePath('/school/branches')
  })
}

export async function updateBranchAction(branchId: string, form: FormData) {
  return run(async () => {
    await courses.updateBranch(await school(), branchId, branchInput(form))
    refreshInventory()
  })
}

export async function archiveBranchAction(branchId: string) {
  return run(async () => {
    await courses.archiveBranch(await school(), branchId)
    revalidatePath('/school/branches')
  })
}

// Course types ----------------------------------------------------------------

/**
 * The course's location: an existing branch, or a new one created from the form
 * ("__new" = an address anywhere in Germany, "__online" = online).
 */
async function resolveBranchId(actor: SchoolActor, form: FormData) {
  const choice = str(form, 'branchId')
  if (choice === '__online') {
    const existing = await prisma.branch.findFirst({ where: { schoolId: actor.schoolId, isOnline: true, archivedAt: null } })
    return existing?.id ?? (await courses.createBranch(actor, { name: 'Online', isOnline: true })).id
  }
  if (choice === '__new') {
    const city = str(form, 'newCity')
    const branch = await courses.createBranch(actor, {
      name: optStr(form, 'newBranchName') || city,
      address: optStr(form, 'newAddress'),
      postcode: optStr(form, 'newPostcode'),
      cityName: city,
    })
    return branch.id
  }
  return choice
}

function courseInput(form: FormData) {
  return {
    branchId: str(form, 'branchId'),
    name: str(form, 'name'),
    languageCode: str(form, 'languageCode') || 'de',
    level: str(form, 'level') as 'A1',
    category: str(form, 'category') as 'STANDARD',
    format: str(form, 'format') as 'IN_PERSON',
    description: optStr(form, 'description'),
    lessonsPerWeek: num(form, 'lessonsPerWeek') ?? 0,
    lessonMinutes: num(form, 'lessonMinutes') ?? 45,
    cancellationTerms: str(form, 'cancellationTerms'),
  }
}

export async function createCourseAction(form: FormData) {
  return run(async () => {
    const actor = await school()
    const course = await courses.createCourseType(actor, { ...courseInput(form), branchId: await resolveBranchId(actor, form) })
    revalidatePath('/school/courses')
    return course.id
  })
}

/** "New course": location (new or existing), the course and its first dated intake in one step. */
export async function createCourseWithIntakeAction(form: FormData) {
  return run(async () => {
    const actor = await school()
    // Check everything before saving anything, so a typo doesn't leave half a course behind.
    courseTypeSchema.parse({ ...courseInput(form), branchId: 'pending' })
    intakeSchema.parse(intakeInput(form))
    const branchId = await resolveBranchId(actor, form)
    const course = await courses.createCourseType(actor, { ...courseInput(form), branchId })
    await courses.createIntake(actor, course.id, intakeInput(form))
    refreshInventory()
    return course.id
  })
}

export async function updateCourseAction(courseTypeId: string, form: FormData) {
  return run(async () => {
    const actor = await school()
    await courses.updateCourseType(actor, courseTypeId, { ...courseInput(form), branchId: await resolveBranchId(actor, form) })
    refreshInventory()
  })
}

export async function submitCourseAction(courseTypeId: string) {
  return run(async () => {
    await courses.submitCourseType(await school(), courseTypeId)
    refreshInventory()
  })
}

export async function archiveCourseAction(courseTypeId: string) {
  return run(async () => {
    await courses.archiveCourseType(await school(), courseTypeId)
    refreshInventory()
  })
}

// Intakes -----------------------------------------------------------------------

const feesJson = z
  .array(z.object({ label: z.string(), amount: z.string(), compulsory: z.boolean() }))
  .catch([])

function intakeInput(form: FormData) {
  const fees = feesJson.parse(JSON.parse(str(form, 'fees') || '[]')).filter((f) => f.label.trim())
  return {
    startDate: str(form, 'startDate'),
    endDate: str(form, 'endDate'),
    weekdays: ints(form, 'weekdays'),
    startTime: str(form, 'startTime'),
    endTime: str(form, 'endTime'),
    priceCents: cents(form, 'price') ?? Number.NaN,
    capacity: num(form, 'capacity') ?? 0,
    bookingDeadline: optStr(form, 'bookingDeadline'),
    instantBooking: bool(form, 'instantBooking'),
    fees: fees.map((f) => {
      const amount = Number(f.amount.replace(',', '.'))
      return { label: f.label.trim(), amountCents: Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN, compulsory: f.compulsory }
    }),
  }
}

export async function createIntakeAction(courseTypeId: string, form: FormData) {
  return run(async () => {
    const intake = await courses.createIntake(await school(), courseTypeId, intakeInput(form))
    refreshInventory()
    return intake.id
  })
}

export async function updateIntakeAction(intakeId: string, form: FormData) {
  return run(async () => {
    await courses.updateIntake(await school(), intakeId, intakeInput(form))
    refreshInventory(intakeId)
  })
}

export async function setIntakeStatusAction(intakeId: string, status: 'OPEN' | 'PAUSED' | 'CLOSED') {
  return run(async () => {
    await courses.setIntakeStatus(await school(), intakeId, status)
    refreshInventory(intakeId)
  })
}

export async function confirmIntakesAction(intakeIds: string[]) {
  return run(async () => {
    await courses.confirmIntakeInformation(await school(), intakeIds)
    refreshInventory()
  })
}

export async function archiveIntakeAction(intakeId: string) {
  return run(async () => {
    await courses.archiveIntake(await school(), intakeId)
    refreshInventory(intakeId)
  })
}

// Bookings ----------------------------------------------------------------------

export async function directEnrolmentAction(intakeId: string, form: FormData) {
  return run(async () => {
    const price = cents(form, 'price')
    const { booking } = await manage.createDirectEnrolment(await school(), intakeId, {
      studentName: str(form, 'studentName'),
      studentEmail: str(form, 'studentEmail'),
      studentPhone: optStr(form, 'studentPhone'),
      notes: optStr(form, 'notes'),
      priceCents: price,
      paidCents: cents(form, 'paid') ?? 0,
      paymentMethod: (str(form, 'paymentMethod') || 'BANK_TRANSFER') as 'BANK_TRANSFER',
      sendConfirmation: bool(form, 'sendConfirmation'),
    })
    refreshInventory(intakeId)
    return booking.id
  })
}

export async function cancelBookingAction(bookingId: string, form: FormData) {
  return run(async () => {
    await manage.cancelBookingAsSchool(await school(), bookingId, {
      reason: str(form, 'reason'),
      refundCents: cents(form, 'refund') ?? 0,
      notifyStudent: bool(form, 'notifyStudent'),
    })
    refreshInventory()
  })
}

export async function transferBookingAction(bookingId: string, form: FormData) {
  return run(async () => {
    const newId = await manage.transferBooking(await school(), bookingId, str(form, 'toIntakeId'), str(form, 'reason'))
    refreshInventory()
    return newId
  })
}

export async function recordPaymentAction(bookingId: string, form: FormData) {
  return run(async () => {
    await manage.recordPayment(await school(), bookingId, {
      amountCents: cents(form, 'amount') ?? 0,
      method: str(form, 'method') as 'CASH',
      paidAt: optStr(form, 'paidAt'),
      note: optStr(form, 'note'),
    })
    revalidatePath(`/school/bookings/${bookingId}`)
  })
}

// Enquiries ---------------------------------------------------------------------

export async function answerEnquiryAction(enquiryId: string, form: FormData) {
  return run(async () => {
    await answerEnquiry(await school(), enquiryId, str(form, 'response'))
    revalidatePath('/school/enquiries')
  })
}

export async function closeEnquiryAction(enquiryId: string) {
  return run(async () => {
    await closeEnquiry(await school(), enquiryId)
    revalidatePath('/school/enquiries')
  })
}

// Team --------------------------------------------------------------------------

export async function inviteStaffAction(form: FormData) {
  return run(async () => {
    await inviteStaff(await school(), {
      email: str(form, 'email'),
      canManageCourses: bool(form, 'canManageCourses'),
      canManageBookings: bool(form, 'canManageBookings'),
      canViewFinances: bool(form, 'canViewFinances'),
      canManageStaff: bool(form, 'canManageStaff'),
    })
    revalidatePath('/school/team')
  })
}

export async function updateMemberAction(membershipId: string, form: FormData) {
  return run(async () => {
    await updateMembership(await school(), membershipId, {
      canManageCourses: bool(form, 'canManageCourses'),
      canManageBookings: bool(form, 'canManageBookings'),
      canViewFinances: bool(form, 'canViewFinances'),
      canManageStaff: bool(form, 'canManageStaff'),
    })
    revalidatePath('/school/team')
  })
}

export async function removeMemberAction(membershipId: string) {
  return run(async () => {
    await removeMembership(await school(), membershipId)
    revalidatePath('/school/team')
  })
}

export async function revokeStaffInvitationAction(invitationId: string) {
  return run(async () => {
    const actor = await school()
    const invitation = await prisma.schoolInvitation.findUnique({ where: { id: invitationId } })
    if (!invitation || invitation.schoolId !== actor.schoolId) throw new AppError('NOT_FOUND')
    await revokeInvitation(actor, invitationId)
    revalidatePath('/school/team')
  })
}

export async function acceptInvitationAction(token: string) {
  return run(async () => {
    const actor = await getActor()
    if (!actor) throw new AppError('UNAUTHENTICATED')
    const schoolId = await acceptStaffInvitation(actor, token)
    ;(await cookies()).set(ACTIVE_SCHOOL_COOKIE, schoolId, { path: '/', httpOnly: true, sameSite: 'lax' })
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } })
    await setFlash('success', 'invitationAccepted', { school: school?.name ?? '' })
  })
}

export async function markNotificationsReadAction() {
  return run(async () => {
    const actor = await school()
    await prisma.notification.updateMany({ where: { schoolId: actor.schoolId, readAt: null }, data: { readAt: new Date() } })
    revalidatePath('/school', 'layout')
  })
}
