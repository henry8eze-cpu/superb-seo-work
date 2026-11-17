'use server'

// Server actions for the internal admin system. Each one resolves the signed-in
// platform admin from the database, delegates to the service layer, and revalidates.

import { revalidatePublic as revalidatePath } from '@/lib/public-cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { run, str, optStr, bool, strings, cents, num } from '@/lib/action-result'
import { getActor, ACTIVE_SCHOOL_COOKIE } from '@/lib/session'
import { AppError } from '@/lib/errors'
import { setFlash } from '@/lib/flash'
import { prisma } from '@/lib/prisma'
import type { Actor } from '@/lib/permissions'
import * as research from '@/lib/services/school-research'
import * as onboarding from '@/lib/services/onboarding'
import { reviewCourseType } from '@/lib/services/courses'
import { setCommissionTerms, setSubscription } from '@/lib/services/billing'
import { updateSupportRequest } from '@/lib/services/enquiries'
import { cancelBookingAsAdmin } from '@/lib/booking/manage'
import { executeRefund } from '@/lib/booking/inventory'

async function admin(): Promise<Actor> {
  const actor = await getActor()
  if (!actor || actor.role !== 'PLATFORM_ADMIN') throw new AppError('FORBIDDEN')
  return actor
}

function schoolDetails(form: FormData) {
  return {
    name: str(form, 'name'),
    legalName: optStr(form, 'legalName'),
    description: optStr(form, 'description'),
    website: optStr(form, 'website'),
    publicEmail: optStr(form, 'publicEmail'),
    phone: optStr(form, 'phone'),
    schoolType: str(form, 'schoolType') as research.SchoolTypeValue,
    cityId: optStr(form, 'cityId'),
    languagesOffered: strings(form, 'languagesOffered'),
    courseTypesOffered: strings(form, 'courseTypesOffered') as research.CourseCategoryValue[],
  }
}

// Cities ---------------------------------------------------------------------

export async function createCityAction(form: FormData) {
  return run(async () => {
    await research.createCity(await admin(), { name: str(form, 'name'), priority: num(form, 'priority') ?? 100 })
    revalidatePath('/admin/cities')
  })
}

export async function setCityStatusAction(cityId: string, form: FormData) {
  return run(async () => {
    await research.setCityResearchStatus(await admin(), cityId, str(form, 'status') as 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE')
    revalidatePath('/admin/cities')
  })
}

// Schools --------------------------------------------------------------------

export async function createSchoolAction(form: FormData) {
  return run(async () => {
    const school = await research.createSchool(await admin(), schoolDetails(form), {
      url: optStr(form, 'sourceUrl'),
      sourceType: (str(form, 'sourceType') || 'SCHOOL_WEBSITE') as research.SourceTypeValue,
      notes: optStr(form, 'sourceNotes'),
    })
    revalidatePath('/admin/schools')
    return school.id
  })
}

export async function updateSchoolAction(schoolId: string, form: FormData) {
  return run(async () => {
    await research.updateSchoolDetails(await admin(), schoolId, schoolDetails(form))
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

export async function verifySchoolAction(schoolId: string, form: FormData) {
  return run(async () => {
    await research.verifySchool(await admin(), schoolId, { legalName: optStr(form, 'legalName') })
    revalidatePath(`/admin/schools/${schoolId}`)
    revalidatePath('/admin/cities')
  })
}

export async function deactivateSchoolAction(schoolId: string, form: FormData) {
  return run(async () => {
    await research.markSchoolInactive(await admin(), schoolId, str(form, 'reason'))
    revalidatePath(`/admin/schools/${schoolId}`)
    revalidatePath('/courses')
  })
}

export async function reactivateSchoolAction(schoolId: string) {
  return run(async () => {
    await research.reactivateSchool(await admin(), schoolId)
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

export async function markCheckedAction(schoolId: string) {
  return run(async () => {
    await research.markSchoolChecked(await admin(), schoolId)
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

export async function addSourceAction(schoolId: string, form: FormData) {
  return run(async () => {
    await research.addResearchSource(await admin(), schoolId, {
      field: optStr(form, 'field'),
      url: optStr(form, 'url'),
      sourceType: str(form, 'sourceType') as research.SourceTypeValue,
      retrievedAt: optStr(form, 'retrievedAt'),
      notes: optStr(form, 'notes'),
    })
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

export async function deleteSourceAction(schoolId: string, sourceId: string) {
  return run(async () => {
    await research.deleteResearchSource(await admin(), sourceId)
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

export async function addContactAttemptAction(schoolId: string, form: FormData) {
  return run(async () => {
    await research.addContactAttempt(await admin(), schoolId, {
      channel: str(form, 'channel') as research.ContactChannelValue,
      outcome: str(form, 'outcome') as research.ContactOutcomeValue,
      contactedAt: optStr(form, 'contactedAt'),
      notes: optStr(form, 'notes'),
      nextStep: optStr(form, 'nextStep'),
      nextStepDate: optStr(form, 'nextStepDate'),
    })
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

export async function addStaffContactAction(schoolId: string, form: FormData) {
  return run(async () => {
    await research.addStaffContact(await admin(), schoolId, {
      name: str(form, 'name'),
      position: optStr(form, 'position'),
      email: optStr(form, 'email'),
      phone: optStr(form, 'phone'),
      notes: optStr(form, 'notes'),
    })
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

export async function deleteStaffContactAction(schoolId: string, contactId: string) {
  return run(async () => {
    await research.deleteStaffContact(await admin(), contactId)
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

export async function addBranchAction(schoolId: string, form: FormData) {
  return run(async () => {
    await research.addBranchAsAdmin(await admin(), schoolId, {
      name: str(form, 'name'),
      isOnline: bool(form, 'isOnline'),
      address: optStr(form, 'address'),
      postcode: optStr(form, 'postcode'),
      cityName: optStr(form, 'cityName'),
      phone: optStr(form, 'phone'),
    })
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

export async function inviteSchoolAction(schoolId: string, form: FormData) {
  return run(async () => {
    await onboarding.inviteSchoolToClaim(await admin(), schoolId, str(form, 'email'))
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

export async function revokeInvitationAction(schoolId: string, invitationId: string) {
  return run(async () => {
    await onboarding.revokeInvitation(await admin(), invitationId)
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

/** Opens the school app for this school, for support or to enter a verified school's public courses. */
export async function openSchoolWorkspaceAction(schoolId: string) {
  await admin()
  ;(await cookies()).set(ACTIVE_SCHOOL_COOKIE, schoolId, { path: '/', httpOnly: true, sameSite: 'lax' })
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } })
  await setFlash('info', 'supportModeOn', { school: school?.name ?? '' })
  redirect('/school')
}

// Import & duplicates --------------------------------------------------------

export async function importSchoolsAction(form: FormData) {
  return run(async () => {
    const actor = await admin()
    const file = form.get('file')
    let csv = str(form, 'csv')
    let fileName: string | undefined
    if (file instanceof File && file.size > 0) {
      if (file.size > 2 * 1024 * 1024) throw new AppError('VALIDATION', 'Max. 2 MB')
      csv = await file.text()
      fileName = file.name
    }
    if (!csv) throw new AppError('VALIDATION')
    const result = await research.importSchoolsCsv(actor, csv, { cityId: optStr(form, 'cityId'), fileName })
    revalidatePath('/admin/schools')
    revalidatePath('/admin/cities')
    revalidatePath('/admin/duplicates')
    return result
  })
}

export async function mergeSchoolsAction(candidateId: string, form: FormData) {
  return run(async () => {
    const keepId = str(form, 'keepId')
    const removeId = str(form, 'removeId')
    const choices: Partial<Record<research.MergeableField, 'keep' | 'remove'>> = {}
    for (const field of research.MERGEABLE_FIELDS) {
      const value = str(form, `field_${field}`)
      if (value === 'keep' || value === 'remove') choices[field] = value
    }
    await research.mergeSchools(await admin(), keepId, removeId, choices)
    revalidatePath('/admin/duplicates')
    return keepId
  })
}

export async function dismissDuplicateAction(candidateId: string) {
  return run(async () => {
    await research.dismissDuplicate(await admin(), candidateId)
    revalidatePath('/admin/duplicates')
  })
}

// Claims ---------------------------------------------------------------------

export async function approveClaimAction(claimId: string, form: FormData) {
  return run(async () => {
    await onboarding.approveClaim(await admin(), claimId, optStr(form, 'note'))
    revalidatePath('/admin/claims')
    revalidatePath(`/admin/claims/${claimId}`)
  })
}

export async function rejectClaimAction(claimId: string, form: FormData) {
  return run(async () => {
    await onboarding.rejectClaim(await admin(), claimId, str(form, 'note'))
    revalidatePath('/admin/claims')
    revalidatePath(`/admin/claims/${claimId}`)
  })
}

// Course approval ------------------------------------------------------------

export async function approveCourseAction(courseTypeId: string) {
  return run(async () => {
    await reviewCourseType(await admin(), courseTypeId, 'approve')
    revalidatePath('/admin/approvals')
    revalidatePath('/courses')
  })
}

export async function rejectCourseAction(courseTypeId: string, form: FormData) {
  return run(async () => {
    await reviewCourseType(await admin(), courseTypeId, 'reject', str(form, 'reason'))
    revalidatePath('/admin/approvals')
  })
}

// Billing --------------------------------------------------------------------

export async function setCommissionAction(schoolId: string, form: FormData) {
  return run(async () => {
    const type = str(form, 'type') as 'FIXED' | 'PERCENT'
    const percent = num(form, 'percent')
    await setCommissionTerms(await admin(), schoolId, {
      type,
      fixedCents: type === 'FIXED' ? cents(form, 'fixed') : undefined,
      percentBps: type === 'PERCENT' && percent !== undefined ? Math.round(percent * 100) : undefined,
      validFrom: optStr(form, 'validFrom'),
      note: optStr(form, 'note'),
    })
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

export async function setSubscriptionAction(schoolId: string, form: FormData) {
  return run(async () => {
    await setSubscription(await admin(), schoolId, {
      monthlyPriceCents: cents(form, 'monthlyPrice') ?? 0,
      status: str(form, 'status') as 'NONE' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED',
      startedAt: optStr(form, 'startedAt'),
      note: optStr(form, 'note'),
    })
    revalidatePath(`/admin/schools/${schoolId}`)
  })
}

// Bookings & support ---------------------------------------------------------

export async function adminCancelBookingAction(bookingId: string, form: FormData) {
  return run(async () => {
    await cancelBookingAsAdmin(await admin(), bookingId, {
      reason: str(form, 'reason'),
      refundCents: cents(form, 'refund') ?? 0,
      notifyStudent: bool(form, 'notifyStudent'),
    })
    revalidatePath(`/admin/bookings/${bookingId}`)
  })
}

export async function retryRefundAction(bookingId: string, refundId: string) {
  return run(async () => {
    await admin()
    await executeRefund(refundId)
    revalidatePath(`/admin/bookings/${bookingId}`)
  })
}

export async function updateSupportAction(requestId: string, form: FormData) {
  return run(async () => {
    await updateSupportRequest(await admin(), requestId, {
      status: str(form, 'status') as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED',
      resolution: optStr(form, 'resolution'),
      assignToMe: bool(form, 'assignToMe'),
    })
    revalidatePath('/admin/support')
    revalidatePath(`/admin/support/${requestId}`)
  })
}
