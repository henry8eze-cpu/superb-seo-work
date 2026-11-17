// Numbers for the school owner dashboard, always scoped to one school.

import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { getAvailability } from '../booking/inventory'
import { paymentSummary } from '../booking/manage'
import { STALE_AFTER_DAYS } from '../config'

export type DashboardFilters = { schoolId: string; branchId?: string; courseTypeId?: string; from: Date; to: Date }

const DAY = 86_400_000

function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Monday 00:00 UTC of the week containing `date`. */
function weekStart(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d
}

export async function getSchoolDashboard(f: DashboardFilters, now = new Date()) {
  const length = f.to.getTime() - f.from.getTime()
  const prev = { gte: new Date(f.from.getTime() - length), lt: f.from }
  const period = { gte: f.from, lt: f.to }

  const intakeScope: Prisma.IntakeWhereInput = { schoolId: f.schoolId }
  if (f.branchId) intakeScope.courseType = { branchId: f.branchId }
  if (f.courseTypeId) intakeScope.courseTypeId = f.courseTypeId
  const bookings: Prisma.BookingWhereInput = { schoolId: f.schoolId, intake: intakeScope }
  const enquiries: Prisma.EnquiryWhereInput = { schoolId: f.schoolId, ...(f.courseTypeId ? { courseTypeId: f.courseTypeId } : {}) }

  const weeksBack = 12
  const firstWeek = new Date(weekStart(new Date(f.to.getTime() - DAY)).getTime() - (weeksBack - 1) * 7 * DAY)
  const staleBefore = new Date(now.getTime() - STALE_AFTER_DAYS * DAY)

  const [
    newNow,
    newPrev,
    confirmedNow,
    confirmedPrev,
    cancelledNow,
    cancelledPrev,
    revenueNow,
    revenuePrev,
    weekly,
    upcoming,
    revenueRows,
    enquiryRows,
    newEnquiries,
    cancellationRequests,
    staleIntakes,
    draftCourses,
    rejectedCourses,
    openBookings,
    activity,
  ] = await Promise.all([
    prisma.booking.count({ where: { ...bookings, createdAt: period, status: { in: ['CONFIRMED', 'CANCELLED', 'TRANSFERRED'] } } }),
    prisma.booking.count({ where: { ...bookings, createdAt: prev, status: { in: ['CONFIRMED', 'CANCELLED', 'TRANSFERRED'] } } }),
    prisma.booking.count({ where: { ...bookings, status: 'CONFIRMED', confirmedAt: period } }),
    prisma.booking.count({ where: { ...bookings, status: 'CONFIRMED', confirmedAt: prev } }),
    prisma.booking.count({ where: { ...bookings, status: 'CANCELLED', cancelledAt: period } }),
    prisma.booking.count({ where: { ...bookings, status: 'CANCELLED', cancelledAt: prev } }),
    prisma.booking.aggregate({ where: { ...bookings, status: 'CONFIRMED', confirmedAt: period }, _sum: { totalCents: true } }),
    prisma.booking.aggregate({ where: { ...bookings, status: 'CONFIRMED', confirmedAt: prev }, _sum: { totalCents: true } }),
    prisma.booking.findMany({
      where: { ...bookings, status: { in: ['CONFIRMED', 'TRANSFERRED'] }, confirmedAt: { gte: firstWeek, lt: f.to } },
      select: { confirmedAt: true, channel: true },
    }),
    prisma.intake.findMany({
      where: { ...intakeScope, archivedAt: null, status: { not: 'CLOSED' }, endDate: { gte: now } },
      orderBy: { startDate: 'asc' },
      take: 10,
      select: { id: true, startDate: true, startTime: true, capacity: true, status: true, lastConfirmedAt: true, courseType: { select: { name: true } } },
    }),
    prisma.booking.findMany({
      where: { ...bookings, status: 'CONFIRMED', confirmedAt: period },
      select: { totalCents: true, intake: { select: { courseType: { select: { name: true } } } } },
    }),
    prisma.enquiry.findMany({ where: { ...enquiries, createdAt: period }, select: { createdAt: true, respondedAt: true } }),
    prisma.enquiry.count({ where: { ...enquiries, status: 'NEW' } }),
    prisma.booking.count({ where: { ...bookings, status: 'CONFIRMED', cancellationRequestedAt: { not: null } } }),
    prisma.intake.count({ where: { ...intakeScope, archivedAt: null, status: 'OPEN', startDate: { gte: now }, lastConfirmedAt: { lt: staleBefore } } }),
    prisma.courseType.count({ where: { schoolId: f.schoolId, publicationStatus: 'DRAFT' } }),
    prisma.courseType.count({ where: { schoolId: f.schoolId, publicationStatus: 'REJECTED' } }),
    prisma.booking.findMany({
      where: { ...bookings, status: 'CONFIRMED', intake: { ...intakeScope, endDate: { gte: now } } },
      select: { totalCents: true, status: true, payments: { select: { amountCents: true, status: true, refunds: { select: { amountCents: true, status: true } } } } },
    }),
    prisma.auditEvent.findMany({
      where: { schoolId: f.schoolId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { actor: { select: { name: true } } },
    }),
  ])

  // Weekly confirmed bookings by channel (12 weeks ending with the selected period).
  const weeks = Array.from({ length: weeksBack }, (_, i) => {
    const start = new Date(firstWeek.getTime() + i * 7 * DAY)
    return { start: start.toISOString().slice(0, 10), direct: 0, marketplace: 0 }
  })
  for (const b of weekly) {
    if (!b.confirmedAt) continue
    const index = Math.floor((weekStart(b.confirmedAt).getTime() - firstWeek.getTime()) / (7 * DAY))
    if (index < 0 || index >= weeks.length) continue
    if (b.channel === 'DIRECT') weeks[index].direct++
    else weeks[index].marketplace++
  }

  const availability = await getAvailability(upcoming.map((i) => i.id), now)
  const occupancy = upcoming.map((i) => {
    const seats = availability.get(i.id)
    return {
      id: i.id,
      name: i.courseType.name,
      startDate: i.startDate.toISOString().slice(0, 10),
      startTime: i.startTime,
      status: i.status,
      capacity: i.capacity,
      sold: seats?.confirmed ?? 0,
      held: seats?.held ?? 0,
      free: seats?.available ?? i.capacity,
    }
  })
  const totalCapacity = occupancy.reduce((s, o) => s + o.capacity, 0)
  const totalSold = occupancy.reduce((s, o) => s + o.sold, 0)

  const byCourse = new Map<string, number>()
  for (const r of revenueRows) byCourse.set(r.intake.courseType.name, (byCourse.get(r.intake.courseType.name) ?? 0) + r.totalCents)

  const responseHours = median(enquiryRows.filter((e) => e.respondedAt).map((e) => (e.respondedAt!.getTime() - e.createdAt.getTime()) / 3_600_000))
  const outstandingCents = openBookings.reduce((sum, b) => sum + paymentSummary(b).outstanding, 0)
  const startingSoon = occupancy.filter((o) => {
    const start = new Date(`${o.startDate}T00:00:00Z`).getTime()
    return start >= now.getTime() - DAY && start - now.getTime() <= 7 * DAY
  }).length

  return {
    tiles: {
      newBookings: { now: newNow, prev: newPrev },
      confirmed: { now: confirmedNow, prev: confirmedPrev },
      cancellations: { now: cancelledNow, prev: cancelledPrev },
      revenueCents: { now: revenueNow._sum.totalCents ?? 0, prev: revenuePrev._sum.totalCents ?? 0 },
      occupancy: { sold: totalSold, capacity: totalCapacity },
      enquiries: { now: enquiryRows.length, responseHours },
      outstandingCents,
    },
    weeks,
    occupancy,
    revenueByCourse: [...byCourse.entries()].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents).slice(0, 8),
    todo: { newEnquiries, cancellationRequests, staleIntakes, draftCourses, rejectedCourses, startingSoon, outstandingCents },
    activity: activity.map((a) => ({ id: a.id, action: a.action, entity: a.entity, at: a.createdAt, actor: a.actor?.name ?? null, actorType: a.actorType })),
  }
}
