// Outgoing emails and in-app notifications. Email text lives in lib/i18n/messages/emails.ts.
// Sending never throws: a mail outage must not undo a confirmed booking or an approval.

import { prisma } from './prisma'
import { sendEmailSafely } from './email'
import { getTFor } from './i18n'
import { absoluteUrl, INVITATION_TTL_DAYS, PLATFORM_NAME } from './config'
import { formatMoney } from './money'
import { formatDay } from './dates'

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function layout(locale: string, heading: string, body: string, cta?: { label: string; href: string }) {
  const t = getTFor(locale)
  return `<!doctype html><html lang="${locale}"><body style="margin:0;background:#FAF7F2;font-family:Arial,Helvetica,sans-serif;color:#2F2F2F">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
<p style="font-weight:bold;color:#F2643A;font-size:18px;margin:0 0 24px">${escapeHtml(PLATFORM_NAME)}</p>
<div style="background:#fff;border-radius:10px;padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>
${body}
${cta ? `<p style="margin:28px 0 0"><a href="${escapeHtml(cta.href)}" style="background:#F2643A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:bold">${escapeHtml(cta.label)}</a></p>` : ''}
</div>
<p style="font-size:12px;color:#6B6258;margin-top:16px">${escapeHtml(t('emails.footer', { platform: PLATFORM_NAME }))}</p>
</div></body></html>`
}

const p = (text: string) => `<p style="line-height:1.55;margin:0 0 12px">${escapeHtml(text)}</p>`

function table(rows: [string, string][]) {
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#6B6258;vertical-align:top;width:40%">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:600">${escapeHtml(v)}</td></tr>`
    )
    .join('')}</table>`
}

async function notifyInApp(data: { userId?: string; schoolId?: string; type: string; title: string; body?: string; link?: string }) {
  try {
    await prisma.notification.create({ data })
  } catch (error) {
    console.error('[notify] in-app notification failed', error)
  }
}

/** Email addresses at a school that should hear about bookings: owners and booking managers, else the public address. */
async function schoolRecipients(schoolId: string) {
  const [members, school] = await Promise.all([
    prisma.schoolMembership.findMany({
      where: { schoolId, status: 'ACTIVE', OR: [{ role: 'OWNER' }, { canManageBookings: true }] },
      include: { user: { select: { email: true, locale: true } } },
    }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { publicEmail: true } }),
  ])
  const recipients = members.map((m) => ({ email: m.user.email, locale: m.user.locale }))
  if (recipients.length === 0 && school?.publicEmail) recipients.push({ email: school.publicEmail, locale: 'de' })
  return recipients
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export async function sendClaimInvitation(input: { to: string; schoolName: string; link: string }) {
  const t = getTFor('de')
  const vars = { school: input.schoolName, platform: PLATFORM_NAME, days: INVITATION_TTL_DAYS }
  // Schools are contacted in German first, with the English text below.
  const en = getTFor('en')
  const body =
    p(t('emails.claimInvitation.body', vars)) +
    p(t('emails.claimInvitation.expires', vars)) +
    '<hr style="border:none;border-top:1px solid #E8E4DD;margin:20px 0">' +
    p(en('emails.claimInvitation.body', vars))
  await sendEmailSafely(
    input.to,
    t('emails.claimInvitation.subject', vars),
    layout('de', t('emails.claimInvitation.heading', vars), body, { label: t('emails.claimInvitation.cta'), href: input.link })
  )
}

export async function notifyAdminsOfClaim(input: { claimId: string; schoolName: string; claimantName: string }) {
  const admins = await prisma.user.findMany({ where: { role: 'PLATFORM_ADMIN' }, select: { id: true, email: true, locale: true } })
  const link = `/admin/claims/${input.claimId}`
  for (const admin of admins) {
    const t = getTFor(admin.locale)
    const vars = { school: input.schoolName, name: input.claimantName }
    await notifyInApp({ userId: admin.id, type: 'claim.submitted', title: t('emails.adminClaim.subject', vars), link })
    await sendEmailSafely(
      admin.email,
      t('emails.adminClaim.subject', vars),
      layout(admin.locale, t('emails.adminClaim.subject', vars), p(t('emails.adminClaim.body', vars)), {
        label: t('emails.adminClaim.cta'),
        href: absoluteUrl(link),
      })
    )
  }
}

export async function sendClaimDecision(input: {
  to: string
  locale: string
  name: string
  schoolName: string
  approved: boolean
  note?: string
}) {
  const t = getTFor(input.locale)
  const vars = { name: input.name, school: input.schoolName, platform: PLATFORM_NAME, note: input.note ?? '' }
  if (input.approved) {
    await sendEmailSafely(
      input.to,
      t('emails.claimApproved.subject', vars),
      layout(input.locale, t('emails.claimApproved.subject', vars), p(t('emails.claimApproved.body', vars)), {
        label: t('emails.claimApproved.cta'),
        href: absoluteUrl('/school'),
      })
    )
  } else {
    await sendEmailSafely(
      input.to,
      t('emails.claimRejected.subject', vars),
      layout(
        input.locale,
        t('emails.claimRejected.subject', vars),
        p(t('emails.claimRejected.body', vars)) + (input.note ? p(t('emails.claimRejected.reason', vars)) : '')
      )
    )
  }
}

export async function sendStaffInvitation(input: { to: string; schoolName: string; inviterName: string; link: string }) {
  const t = getTFor('de')
  const en = getTFor('en')
  const vars = { school: input.schoolName, inviter: input.inviterName, platform: PLATFORM_NAME }
  await sendEmailSafely(
    input.to,
    t('emails.staffInvitation.subject', vars),
    layout(
      'de',
      t('emails.staffInvitation.subject', vars),
      p(t('emails.staffInvitation.body', vars)) + p(en('emails.staffInvitation.body', vars)),
      { label: t('emails.staffInvitation.cta'), href: input.link }
    )
  )
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

async function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      studentUser: { select: { locale: true } },
      payments: { where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] } } },
      school: { select: { id: true, name: true } },
      intake: { include: { courseType: { include: { branch: true } } } },
    },
  })
}

type LoadedBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>

function bookingSummary(booking: LoadedBooking, locale: string) {
  const t = getTFor(locale)
  const { intake } = booking
  const { courseType } = intake
  const branch = courseType.branch
  const location = branch.isOnline ? 'Online' : [branch.address, branch.postcode, branch.cityName].filter(Boolean).join(', ')
  const paid = booking.payments.reduce((sum, pay) => sum + pay.amountCents, 0)
  return table([
    [t('emails.bookingConfirmed.course'), courseType.name],
    [t('emails.bookingConfirmed.school'), booking.school.name],
    [t('emails.bookingConfirmed.location'), location || '–'],
    [t('emails.bookingConfirmed.dates'), `${formatDay(intake.startDate, locale)} – ${formatDay(intake.endDate, locale)}`],
    [t('emails.bookingConfirmed.schedule'), `${intake.startTime}–${intake.endTime}`],
    [t('emails.bookingConfirmed.total'), formatMoney(booking.totalCents, booking.currency, locale)],
    booking.paymentMethod === 'PAY_AT_SCHOOL'
      ? [t('emails.bookingConfirmed.payAtSchool'), formatMoney(booking.totalCents - paid, booking.currency, locale)]
      : [t('emails.bookingConfirmed.paid'), formatMoney(paid, booking.currency, locale)],
  ])
}

/** Student confirmation plus school notification, sent the moment a booking is confirmed. */
export async function bookingConfirmed(bookingId: string, seatsLeft: number) {
  const booking = await loadBooking(bookingId)
  if (!booking) return
  const locale = booking.studentUser?.locale ?? 'de'
  const t = getTFor(locale)
  const vars = { name: booking.studentName, reference: booking.reference, course: booking.intake.courseType.name }
  const direct = booking.channel === 'DIRECT'

  await sendEmailSafely(
    booking.studentEmail,
    direct
      ? t('emails.directEnrolment.subject', { ...vars, school: booking.school.name })
      : t('emails.bookingConfirmed.subject', vars),
    layout(
      locale,
      t('emails.bookingConfirmed.heading'),
      p(direct ? t('emails.directEnrolment.intro', { ...vars, school: booking.school.name }) : t('emails.bookingConfirmed.intro', vars)) +
        bookingSummary(booking, locale) +
        `<p style="font-weight:600;margin:16px 0 4px">${escapeHtml(t('emails.bookingConfirmed.cancellation'))}</p>` +
        p(booking.intake.courseType.cancellationTerms),
      booking.studentUserId ? { label: t('emails.bookingConfirmed.cta'), href: absoluteUrl(`/account/bookings/${booking.id}`) } : undefined
    )
  )

  if (direct) return // the school entered it themselves

  const link = `/school/bookings/${booking.id}`
  const schoolVars = {
    reference: booking.reference,
    course: booking.intake.courseType.name,
    student: booking.studentName,
    start: formatDay(booking.intake.startDate, 'de'),
    seats: seatsLeft,
  }
  await notifyInApp({
    schoolId: booking.schoolId,
    type: 'booking.confirmed',
    title: getTFor('de')('emails.schoolNewBooking.subject', schoolVars),
    body: getTFor('de')('emails.schoolNewBooking.body', schoolVars),
    link,
  })
  for (const recipient of await schoolRecipients(booking.schoolId)) {
    const st = getTFor(recipient.locale)
    const localVars = { ...schoolVars, start: formatDay(booking.intake.startDate, recipient.locale) }
    await sendEmailSafely(
      recipient.email,
      st('emails.schoolNewBooking.subject', localVars),
      layout(recipient.locale, st('emails.schoolNewBooking.subject', localVars), p(st('emails.schoolNewBooking.body', localVars)), {
        label: st('emails.schoolNewBooking.cta'),
        href: absoluteUrl(link),
      })
    )
  }
}

export async function bookingRefunded(bookingId: string, amountCents: number) {
  const booking = await loadBooking(bookingId)
  if (!booking) return
  const locale = booking.studentUser?.locale ?? 'de'
  const t = getTFor(locale)
  const vars = { name: booking.studentName, course: booking.intake.courseType.name, amount: formatMoney(amountCents, booking.currency, locale) }
  await sendEmailSafely(
    booking.studentEmail,
    t('emails.bookingRefunded.subject'),
    layout(locale, t('emails.bookingRefunded.subject'), p(t('emails.bookingRefunded.body', vars)))
  )
  if (booking.studentUserId) {
    await notifyInApp({ userId: booking.studentUserId, type: 'booking.refunded', title: t('emails.bookingRefunded.subject'), link: `/account/bookings/${booking.id}` })
  }
}

export async function bookingCancelled(bookingId: string, refundedCents: number) {
  const booking = await loadBooking(bookingId)
  if (!booking) return
  const locale = booking.studentUser?.locale ?? 'de'
  const t = getTFor(locale)
  const vars = {
    name: booking.studentName,
    reference: booking.reference,
    course: booking.intake.courseType.name,
    amount: formatMoney(refundedCents, booking.currency, locale),
  }
  await sendEmailSafely(
    booking.studentEmail,
    t('emails.bookingCancelled.subject', vars),
    layout(
      locale,
      t('emails.bookingCancelled.subject', vars),
      p(t('emails.bookingCancelled.body', vars)) + (refundedCents > 0 ? p(t('emails.bookingCancelled.refund', vars)) : '')
    )
  )
}

export async function bookingTransferred(newBookingId: string) {
  const booking = await loadBooking(newBookingId)
  if (!booking) return
  const locale = booking.studentUser?.locale ?? 'de'
  const t = getTFor(locale)
  const vars = {
    name: booking.studentName,
    reference: booking.reference,
    course: booking.intake.courseType.name,
    start: formatDay(booking.intake.startDate, locale),
  }
  await sendEmailSafely(
    booking.studentEmail,
    t('emails.bookingTransferred.subject', vars),
    layout(locale, t('emails.bookingTransferred.subject', vars), p(t('emails.bookingTransferred.body', vars)) + bookingSummary(booking, locale))
  )
}

// ---------------------------------------------------------------------------
// Enquiries
// ---------------------------------------------------------------------------

export async function enquiryReceived(enquiryId: string) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id: enquiryId }, include: { courseType: true, school: { select: { name: true, status: true } } } })
  if (!enquiry) return
  const course = enquiry.courseType?.name ?? '–'
  const vars = { name: enquiry.name, course, message: enquiry.message.slice(0, 300) }

  // Schools that have not joined the platform never receive mail from us unasked:
  // their enquiries go to our team, who pass them on or answer from public information.
  if (enquiry.school.status !== 'PARTNER') {
    await prisma.supportRequest.create({
      data: {
        type: 'GENERAL',
        subject: `Anfrage für ${enquiry.school.name}: ${course}`,
        message: `${enquiry.message}\n\n— ${enquiry.name}, ${enquiry.email}${enquiry.phone ? `, ${enquiry.phone}` : ''}`,
        email: enquiry.email,
        requesterId: enquiry.userId,
        schoolId: enquiry.schoolId,
      },
    })
    const admins = await prisma.user.findMany({ where: { role: 'PLATFORM_ADMIN' }, select: { id: true, email: true, locale: true } })
    for (const admin of admins) {
      const t = getTFor(admin.locale)
      await notifyInApp({ userId: admin.id, type: 'enquiry.non_partner', title: `${enquiry.school.name}: ${t('emails.enquiryReceived.subject', vars)}`, link: '/admin/support' })
      await sendEmailSafely(
        admin.email,
        `${enquiry.school.name}: ${t('emails.enquiryReceived.subject', vars)}`,
        layout(admin.locale, t('emails.enquiryReceived.subject', vars), p(t('emails.enquiryReceived.body', vars)), {
          label: t('emails.enquiryReceived.cta'),
          href: absoluteUrl('/admin/support'),
        })
      )
    }
    return
  }

  const link = `/school/enquiries?open=${enquiry.id}`
  await notifyInApp({ schoolId: enquiry.schoolId, type: 'enquiry.received', title: getTFor('de')('emails.enquiryReceived.subject', vars), link })

  const recipients = await schoolRecipients(enquiry.schoolId)
  for (const recipient of recipients) {
    const t = getTFor(recipient.locale)
    await sendEmailSafely(
      recipient.email,
      t('emails.enquiryReceived.subject', vars),
      layout(recipient.locale, t('emails.enquiryReceived.subject', vars), p(t('emails.enquiryReceived.body', vars)), {
        label: t('emails.enquiryReceived.cta'),
        href: absoluteUrl(link),
      })
    )
  }
}

export async function enquiryAnswered(enquiryId: string) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: { courseType: true, school: true, user: { select: { locale: true } } },
  })
  if (!enquiry?.response) return
  const locale = enquiry.user?.locale ?? 'de'
  const t = getTFor(locale)
  const vars = { name: enquiry.name, school: enquiry.school.name, course: enquiry.courseType?.name ?? '–' }
  await sendEmailSafely(
    enquiry.email,
    t('emails.enquiryAnswered.subject', vars),
    layout(
      locale,
      t('emails.enquiryAnswered.subject', vars),
      p(t('emails.enquiryAnswered.body', vars)) +
        `<blockquote style="border-left:3px solid #F2643A;margin:12px 0;padding:4px 12px;white-space:pre-wrap">${escapeHtml(enquiry.response)}</blockquote>` +
        p(t('emails.enquiryAnswered.notGuaranteed'))
    )
  )
}
