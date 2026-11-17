import type { Prisma } from '@prisma/client'

export type BookingFilters = {
  search?: string
  schoolId?: string
  cityId?: string
  status?: string
  channel?: string
  from?: string
  to?: string
  intakeId?: string
  courseTypeId?: string
  branchId?: string
}

const STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'FAILED_REFUNDED', 'TRANSFERRED']

export function readBookingFilters(params: Record<string, string | undefined>): BookingFilters {
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
  return {
    search: params.search?.trim() || undefined,
    schoolId: params.school || undefined,
    cityId: params.city || undefined,
    status: STATUSES.includes(params.status ?? '') ? params.status : undefined,
    channel: params.channel === 'MARKETPLACE' || params.channel === 'DIRECT' ? params.channel : undefined,
    from: date(params.from),
    to: date(params.to),
    intakeId: params.intake || undefined,
    courseTypeId: params.course || undefined,
    branchId: params.branch || undefined,
  }
}

/** Filters on when the booking was created. `schoolId` scoping for school users is added by the caller. */
export function bookingWhere(filters: BookingFilters): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {}
  const and: Prisma.BookingWhereInput[] = []
  if (filters.search) {
    and.push({
      OR: [
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { studentName: { contains: filters.search, mode: 'insensitive' } },
        { studentEmail: { contains: filters.search, mode: 'insensitive' } },
      ],
    })
  }
  if (filters.schoolId) and.push({ schoolId: filters.schoolId })
  if (filters.cityId) and.push({ intake: { courseType: { branch: { cityId: filters.cityId } } } })
  if (filters.status) and.push({ status: filters.status as Prisma.BookingWhereInput['status'] })
  if (filters.channel) and.push({ channel: filters.channel as Prisma.BookingWhereInput['channel'] })
  if (filters.intakeId) and.push({ intakeId: filters.intakeId })
  if (filters.courseTypeId) and.push({ intake: { courseTypeId: filters.courseTypeId } })
  if (filters.branchId) and.push({ intake: { courseType: { branchId: filters.branchId } } })
  if (filters.from) and.push({ createdAt: { gte: new Date(`${filters.from}T00:00:00Z`) } })
  if (filters.to) and.push({ createdAt: { lt: new Date(new Date(`${filters.to}T00:00:00Z`).getTime() + 86_400_000) } })
  if (and.length) where.AND = and
  return where
}

export function filtersToQuery(filters: BookingFilters) {
  const qs = new URLSearchParams()
  const map: Record<string, string | undefined> = {
    search: filters.search,
    school: filters.schoolId,
    city: filters.cityId,
    status: filters.status,
    channel: filters.channel,
    from: filters.from,
    to: filters.to,
    intake: filters.intakeId,
    course: filters.courseTypeId,
    branch: filters.branchId,
  }
  for (const [k, v] of Object.entries(map)) if (v) qs.set(k, v)
  return qs
}
