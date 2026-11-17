import { prisma } from '@/lib/prisma'
import { getPaymentProvider } from '@/lib/payments'
import type { MockPaymentProvider } from '@/lib/payments/mock'
import { permissionsFor, type Actor, type SchoolActor } from '@/lib/permissions'
import type { SchoolStatus } from '@prisma/client'

let counter = 0
const next = () => ++counter

export const mockPayments = () => getPaymentProvider() as MockPaymentProvider

export function daysFromNow(days: number) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export async function createUser(role: 'PLATFORM_ADMIN' | 'SCHOOL_USER' | 'STUDENT' = 'STUDENT', name?: string): Promise<Actor> {
  const n = next()
  const user = await prisma.user.create({
    data: { email: `user${n}@example.test`, name: name ?? `User ${n}`, role, student: role === 'STUDENT' ? { create: {} } : undefined },
  })
  return { userId: user.id, role: user.role, name: user.name, email: user.email }
}

export async function ensureReferenceData() {
  await prisma.language.upsert({ where: { code: 'de' }, update: {}, create: { code: 'de', nameEn: 'German', nameDe: 'Deutsch' } })
  return prisma.city.upsert({
    where: { slug: 'essen' },
    update: {},
    create: { name: 'Essen', slug: 'essen', priority: 1, lat: 51.4556, lng: 7.0116 },
  })
}

type SchoolOptions = { status?: SchoolStatus; instantBooking?: boolean; payAtSchool?: boolean; name?: string }

/** A school with one owner, one branch and one published course type. */
export async function createSchool(options: SchoolOptions = {}) {
  const city = await ensureReferenceData()
  const n = next()
  const status = options.status ?? 'PARTNER'
  const school = await prisma.school.create({
    data: {
      slug: `school-${n}`,
      name: options.name ?? `Sprachschule ${n}`,
      nameNormalized: `sprachschule ${n}`,
      status,
      instantBookingEnabled: status === 'PARTNER' ? options.instantBooking ?? true : false,
      allowPayAtSchool: options.payAtSchool ?? false,
      cityId: city.id,
      partnerSince: status === 'PARTNER' ? new Date() : null,
    },
  })
  const owner = await createUser('SCHOOL_USER', `Owner ${n}`)
  const membership = await prisma.schoolMembership.create({ data: { schoolId: school.id, userId: owner.userId, role: 'OWNER' } })
  const branch = await prisma.branch.create({
    data: { schoolId: school.id, name: 'Essen Mitte', address: 'Kettwiger Str. 1', postcode: '45127', cityName: 'Essen', cityId: city.id, lat: 51.4556, lng: 7.0116 },
  })
  const courseType = await prisma.courseType.create({
    data: {
      schoolId: school.id,
      branchId: branch.id,
      name: 'Deutsch A1 Abendkurs',
      level: 'A1',
      category: 'EVENING',
      lessonsPerWeek: 6,
      cancellationTerms: 'Free cancellation up to 14 days before the start.',
      publicationStatus: 'PUBLISHED',
    },
  })
  const ownerActor: SchoolActor = { ...owner, schoolId: school.id, schoolRole: 'OWNER', permissions: permissionsFor(membership) }
  return { school, owner: ownerActor, branch, courseType }
}

export async function createIntake(courseTypeId: string, schoolId: string, options: { capacity?: number; priceCents?: number; feeCents?: number; startInDays?: number } = {}) {
  const price = options.priceCents ?? 39_900
  const fee = options.feeCents ?? 0
  return prisma.intake.create({
    data: {
      courseTypeId,
      schoolId,
      startDate: daysFromNow(options.startInDays ?? 30),
      endDate: daysFromNow((options.startInDays ?? 30) + 56),
      weekdays: [1, 3],
      startTime: '18:00',
      endTime: '20:15',
      priceCents: price,
      totalPriceCents: price + fee,
      capacity: options.capacity ?? 10,
      fees: fee ? { create: [{ label: 'Lehrbuch', amountCents: fee }] } : undefined,
    },
  })
}

export async function createStudent() {
  const actor = await createUser('STUDENT')
  return { actor, details: { name: actor.name, email: actor.email } }
}

export function staffActor(base: SchoolActor, permissions: Partial<SchoolActor['permissions']>): SchoolActor {
  return {
    ...base,
    schoolRole: 'STAFF',
    permissions: { manageCourses: false, manageBookings: false, viewFinances: false, manageStaff: false, ...permissions },
  }
}

export function completedEvent(booking: { id: string; totalCents: number; checkoutSessionId?: string | null }, overrides: Partial<{ eventId: string; paymentId: string; amountCents: number }> = {}) {
  const n = next()
  return {
    kind: 'checkout_completed' as const,
    eventId: overrides.eventId ?? `evt_${n}`,
    bookingId: booking.id,
    sessionId: booking.checkoutSessionId ?? `cs_${n}`,
    paymentId: overrides.paymentId ?? `pi_${n}`,
    amountCents: overrides.amountCents ?? booking.totalCents,
    currency: 'EUR',
  }
}
