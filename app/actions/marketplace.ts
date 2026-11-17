'use server'

// Public / student-facing server actions: enquiries, seat holds, checkout,
// cancellation requests, and the profile-claim form.

import { revalidatePublic as revalidatePath } from '@/lib/public-cache'
import { redirect } from 'next/navigation'
import { run, str, optStr, bool } from '@/lib/action-result'
import { getActor } from '@/lib/session'
import { getLocale } from '@/lib/i18n/server'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { createEnquiry, createSupportRequest } from '@/lib/services/enquiries'
import { submitClaim, type ClaimDocumentUpload } from '@/lib/services/onboarding'
import { confirmPayAtSchool, createSeatHold, handlePaymentEvent, releaseSeatHold, startCardCheckout } from '@/lib/booking/inventory'
import { requestCancellation } from '@/lib/booking/manage'
import { getPaymentProvider, mockPaymentsAllowed } from '@/lib/payments'
import { CLAIM_DOCUMENT_MAX_BYTES } from '@/lib/config'
import { setFlash } from '@/lib/flash'

async function requireActor() {
  const actor = await getActor()
  if (!actor) throw new AppError('UNAUTHENTICATED')
  return actor
}

export async function enquiryAction(intakeId: string, form: FormData) {
  return run(async () => {
    const actor = await getActor()
    // Simple honeypot against form spam.
    if (str(form, 'website')) return
    await createEnquiry(
      intakeId,
      { name: str(form, 'name'), email: str(form, 'email'), phone: optStr(form, 'phone'), message: str(form, 'message') },
      actor
    )
  })
}

/** "Book instantly": hold a seat, then go to checkout. */
export async function startBookingAction(intakeId: string, form: FormData) {
  const result = await run(async () => {
    const actor = await requireActor()
    const phone = optStr(form, 'phone')
    const booking = await createSeatHold(actor, intakeId, { name: str(form, 'name') || actor.name, email: actor.email, phone })
    revalidatePath(`/courses/${intakeId}`)
    return booking.id
  })
  if (result.success) {
    await setFlash('info', 'bookingStarted')
    redirect(`/checkout/${result.data}`)
  }
  return result
}

export async function payByCardAction(bookingId: string) {
  const result = await run(async () => {
    const actor = await requireActor()
    const session = await startCardCheckout(actor, bookingId, await getLocale())
    return session.url
  })
  if (result.success && result.data) redirect(result.data)
  return result
}

export async function payAtSchoolAction(bookingId: string) {
  const result = await run(async () => {
    const actor = await requireActor()
    await confirmPayAtSchool(actor, bookingId)
    revalidatePath('/courses', 'layout')
  })
  if (result.success) {
    await setFlash('success', 'bookingConfirmed')
    redirect(`/checkout/${bookingId}/success`)
  }
  return result
}

export async function releaseHoldAction(bookingId: string) {
  const result = await run(async () => {
    const actor = await requireActor()
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { intakeId: true } })
    await releaseSeatHold(actor, bookingId)
    revalidatePath('/courses', 'layout')
    return booking?.intakeId
  })
  if (result.success) await setFlash('success', 'holdReleased')
  if (result.success) redirect(result.data ? `/courses/${result.data}` : '/courses')
  return result
}

/**
 * Development-only stand-in for the payment provider's hosted page and webhook.
 * Refuses to run unless mock payments are allowed.
 */
export async function completeMockPaymentAction(bookingId: string, outcome: 'paid' | 'cancel') {
  const result = await run(async () => {
    if (!mockPaymentsAllowed() || getPaymentProvider().name !== 'mock') throw new AppError('FORBIDDEN')
    const actor = await requireActor()
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking || booking.studentUserId !== actor.userId || !booking.checkoutSessionId) throw new AppError('NOT_FOUND')
    if (outcome === 'cancel') return 'cancel'
    await handlePaymentEvent({
      kind: 'checkout_completed',
      eventId: `mock_evt_${booking.checkoutSessionId}`,
      bookingId,
      sessionId: booking.checkoutSessionId,
      paymentId: `mock_pi_${booking.checkoutSessionId}`,
      amountCents: booking.totalCents,
      currency: booking.currency,
    })
    revalidatePath('/courses', 'layout')
    return 'paid'
  })
  if (result.success && result.data === 'paid') await setFlash('success', 'bookingConfirmed')
  if (result.success) redirect(result.data === 'cancel' ? `/checkout/${bookingId}?cancelled=1` : `/checkout/${bookingId}/success`)
  return result
}

export async function requestCancellationAction(bookingId: string, form: FormData) {
  return run(async () => {
    await requestCancellation(await requireActor(), bookingId, str(form, 'message'))
    revalidatePath(`/account/bookings/${bookingId}`)
  })
}

export async function supportRequestAction(form: FormData) {
  return run(async () => {
    const actor = await getActor()
    if (str(form, 'website')) return
    await createSupportRequest(
      {
        type: (str(form, 'type') || 'GENERAL') as 'GENERAL',
        subject: str(form, 'subject'),
        message: str(form, 'message'),
        email: actor?.email ?? str(form, 'email'),
        bookingId: optStr(form, 'bookingId'),
      },
      actor
    )
  })
}

export async function submitClaimAction(token: string, form: FormData) {
  const result = await run(async () => {
    const actor = await requireActor()
    const documents: ClaimDocumentUpload[] = []
    for (const file of form.getAll('documents')) {
      if (!(file instanceof File) || file.size === 0) continue
      if (file.size > CLAIM_DOCUMENT_MAX_BYTES) throw new AppError('VALIDATION', `${file.name}: max. 3 MB`)
      documents.push({ fileName: file.name, mimeType: file.type, data: Buffer.from(await file.arrayBuffer()) })
    }
    await submitClaim(
      actor,
      token,
      {
        claimantName: str(form, 'claimantName'),
        claimantPosition: str(form, 'claimantPosition'),
        claimantPhone: optStr(form, 'claimantPhone'),
        message: optStr(form, 'message'),
        confirmAuthority: bool(form, 'confirmAuthority') as true,
      },
      documents.slice(0, 3)
    )
  })
  if (result.success) {
    await setFlash('success', 'claimSubmitted')
    redirect('/claim/submitted')
  }
  return result
}
