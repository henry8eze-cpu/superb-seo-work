// Moves the single-school data (Course / Enrollment) into the marketplace
// structure under the "Superb Sprachschule" school. Idempotent: records are
// linked through legacyCourseId / legacyEnrollmentId and skipped on re-runs.
//
// What maps where:
//   Course (with a startDate)  → CourseType + one Intake (capacity = maxStudents)
//   Course (without startDate) → CourseType as DRAFT, no intake (there is no date to sell)
//   Enrollment ACTIVE/COMPLETED → DIRECT booking, CONFIRMED
//   Enrollment DROPPED          → DIRECT booking, CANCELLED
//   paymentStatus PAID          → one recorded payment of the full course price
//   paymentStatus PARTIAL       → noted on the booking (amount unknown in the old data)
// Registrations, trial lessons and certificates stay in the legacy tables.

import type { PrismaClient } from '@prisma/client'

export const SUPERB_SLUG = 'superb-sprachschule-essen'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

function toLevel(value: string) {
  const upper = value.toUpperCase()
  return (LEVELS as readonly string[]).includes(upper) ? (upper as (typeof LEVELS)[number]) : 'B2'
}

function dayOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export async function ensureSuperbSchool(prisma: PrismaClient) {
  const essen = await prisma.city.findUnique({ where: { slug: 'essen' } })
  const school = await prisma.school.upsert({
    where: { slug: SUPERB_SLUG },
    update: {},
    create: {
      slug: SUPERB_SLUG,
      name: 'Superb Sprachschule',
      nameNormalized: 'superb sprachschule',
      website: 'https://superb-sprachschule.de',
      websiteDomain: 'superb-sprachschule.de',
      publicEmail: 'info@superb-sprachschule.de',
      schoolType: 'PRIVATE',
      languagesOffered: ['de'],
      courseTypesOffered: ['STANDARD', 'INTENSIVE', 'EXAM_PREP'],
      cityId: essen?.id,
      status: 'PARTNER',
      onboardingStage: 'ONBOARDED',
      partnerSince: new Date(),
      verifiedAt: new Date(),
      lastCheckedAt: new Date(),
      description: 'CEFR-aligned German courses in Essen and online, from A1 to C1 and exam preparation.',
    },
  })
  let branch = await prisma.branch.findFirst({ where: { schoolId: school.id, isOnline: false } })
  if (!branch) {
    branch = await prisma.branch.create({
      data: { schoolId: school.id, name: 'Essen', postcode: '45127', cityName: 'Essen', cityId: essen?.id, lat: essen?.lat, lng: essen?.lng },
    })
  }
  return { school, branch }
}

export async function migrateLegacy(prisma: PrismaClient, log: (line: string) => void = console.log) {
  const courses = await prisma.course.findMany({ include: { enrollments: { include: { student: { include: { user: true } } } } } })
  if (courses.length === 0) {
    log('Legacy migration: no legacy courses found.')
    return { courses: 0, bookings: 0 }
  }
  const { school, branch } = await ensureSuperbSchool(prisma)
  await prisma.language.upsert({ where: { code: 'de' }, update: {}, create: { code: 'de', nameEn: 'German', nameDe: 'Deutsch', sortOrder: 1 } })

  // Give Superb's admins access to the school app.
  const admins = await prisma.user.findMany({ where: { role: 'PLATFORM_ADMIN' } })
  for (const admin of admins) {
    await prisma.schoolMembership.upsert({
      where: { schoolId_userId: { schoolId: school.id, userId: admin.id } },
      update: {},
      create: { schoolId: school.id, userId: admin.id, role: 'OWNER' },
    })
  }

  let migratedCourses = 0
  let migratedBookings = 0
  for (const course of courses) {
    let intake = await prisma.intake.findUnique({ where: { legacyCourseId: course.id } })
    const priceCents = Math.round(course.price * 100)

    if (!intake) {
      const existingType = await prisma.courseType.findFirst({ where: { schoolId: school.id, name: course.name } })
      const courseType =
        existingType ??
        (await prisma.courseType.create({
          data: {
            schoolId: school.id,
            branchId: branch.id,
            name: course.name,
            languageCode: 'de',
            level: toLevel(course.level),
            category: course.level.toUpperCase() === 'GOETHE' ? 'EXAM_PREP' : 'STANDARD',
            description: course.description,
            lessonsPerWeek: 4,
            cancellationTerms: 'Bitte kontaktieren Sie die Schule. / Please contact the school.',
            // Legacy courses need dates and schedules checked before they are sold on the marketplace.
            publicationStatus: 'DRAFT',
          },
        }))

      if (!course.startDate) {
        if (!existingType) {
          log(`Legacy course "${course.name}" has no start date: created as a draft course without an intake.`)
          migratedCourses++
        }
        continue
      }
      const start = dayOnly(course.startDate)
      const end = new Date(start.getTime() + Math.max(1, Math.ceil(course.duration / 4)) * 7 * 86_400_000)
      intake = await prisma.intake.create({
        data: {
          courseTypeId: courseType.id,
          schoolId: school.id,
          startDate: start,
          endDate: end,
          weekdays: [1, 3],
          startTime: '18:00',
          endTime: '20:00',
          priceCents,
          totalPriceCents: priceCents,
          capacity: Math.max(course.maxStudents, course.enrollments.length),
          status: course.status === 'ACTIVE' ? 'OPEN' : 'CLOSED',
          instantBooking: false, // switch on after the school has checked the schedule
          legacyCourseId: course.id,
        },
      })
      migratedCourses++
    }

    for (const enrollment of course.enrollments) {
      const exists = await prisma.booking.findUnique({ where: { legacyEnrollmentId: enrollment.id } })
      if (exists) continue
      const reference = `SUP-${enrollment.id.slice(-6).toUpperCase()}`
      const booking = await prisma.booking.create({
        data: {
          reference,
          intakeId: intake.id,
          schoolId: school.id,
          channel: 'DIRECT',
          status: enrollment.status === 'DROPPED' ? 'CANCELLED' : 'CONFIRMED',
          confirmedAt: enrollment.enrollmentDate,
          cancelledAt: enrollment.status === 'DROPPED' ? enrollment.updatedAt : null,
          cancelReason: enrollment.status === 'DROPPED' ? 'Dropped (legacy)' : null,
          studentUserId: enrollment.student.userId,
          studentId: enrollment.studentId,
          studentName: enrollment.student.user.name,
          studentEmail: enrollment.student.user.email,
          studentPhone: enrollment.student.phone,
          priceCents,
          totalCents: priceCents,
          notes: enrollment.paymentStatus === 'PARTIAL' ? 'Legacy: partially paid (amount not recorded).' : null,
          legacyEnrollmentId: enrollment.id,
          createdAt: enrollment.enrollmentDate,
        },
      })
      if (enrollment.paymentStatus === 'PAID' && priceCents > 0) {
        await prisma.payment.create({
          data: { bookingId: booking.id, schoolId: school.id, amountCents: priceCents, method: 'OTHER', paidAt: enrollment.updatedAt, note: 'Legacy: marked as paid' },
        })
      }
      migratedBookings++
    }
  }
  log(`Legacy migration: ${migratedCourses} courses and ${migratedBookings} enrolments moved to "${school.name}".`)
  return { courses: migratedCourses, bookings: migratedBookings }
}
