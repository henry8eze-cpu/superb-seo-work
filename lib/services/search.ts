// Marketplace search. Filtering, distance and seat availability are computed in
// SQL so pagination is exact; the booking label comes from the shared rules.

import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { geocodePostcode, findCityByName } from '../geo'
import { bookingMode, type BookingMode, type UnavailableReason } from '../booking/rules'
import { normalizePostcode } from '../schools/normalize'

export const PAGE_SIZE = 12

export type SearchFilters = {
  city?: string
  postcode?: string
  radiusKm?: number
  format?: 'IN_PERSON' | 'ONLINE' | 'HYBRID'
  language?: string
  level?: string
  category?: string
  startFrom?: string
  startTo?: string
  weekdays?: number[]
  timeOfDay?: 'morning' | 'afternoon' | 'evening'
  minWeeks?: number
  maxWeeks?: number
  minLessons?: number
  maxLessons?: number
  minPrice?: number // euros
  maxPrice?: number // euros
  availableOnly?: boolean
  instantOnly?: boolean
  sort?: 'start' | 'price' | 'distance'
  page?: number
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const CATEGORIES = ['STANDARD', 'INTENSIVE', 'EVENING', 'WEEKEND', 'PRIVATE', 'EXAM_PREP', 'INTEGRATION']

function num(value: string | undefined | null) {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

/** Reads filters from URL search params, dropping anything invalid. */
export function parseSearchParams(params: Record<string, string | string[] | undefined>): SearchFilters {
  const get = (key: string) => {
    const v = params[key]
    return Array.isArray(v) ? v[0] : v
  }
  const all = (key: string) => {
    const v = params[key]
    return (Array.isArray(v) ? v : v ? v.split(',') : []).filter(Boolean)
  }
  const format = get('format')
  const timeOfDay = get('time')
  const sort = get('sort')
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
  // The home page has a single "city or postcode" box.
  const cityInput = get('city')?.trim()
  const cityIsPostcode = !!cityInput && /^\d{5}$/.test(cityInput)
  return {
    city: cityIsPostcode ? undefined : cityInput || undefined,
    postcode: normalizePostcode(get('postcode')) ?? (cityIsPostcode ? cityInput : undefined),
    radiusKm: num(get('radius')),
    format: format === 'IN_PERSON' || format === 'ONLINE' || format === 'HYBRID' ? format : undefined,
    language: get('language')?.toLowerCase().slice(0, 5) || undefined,
    level: LEVELS.includes(get('level') ?? '') ? get('level') : undefined,
    category: CATEGORIES.includes(get('category') ?? '') ? get('category') : undefined,
    startFrom: date(get('from')),
    startTo: date(get('to')),
    weekdays: all('days').map(Number).filter((d) => d >= 1 && d <= 7),
    timeOfDay: timeOfDay === 'morning' || timeOfDay === 'afternoon' || timeOfDay === 'evening' ? timeOfDay : undefined,
    minWeeks: num(get('minWeeks')),
    maxWeeks: num(get('maxWeeks')),
    minLessons: num(get('minLessons')),
    maxLessons: num(get('maxLessons')),
    minPrice: num(get('minPrice')),
    maxPrice: num(get('maxPrice')),
    availableOnly: get('available') === '1',
    instantOnly: get('instant') === '1',
    sort: sort === 'price' || sort === 'distance' ? sort : 'start',
    page: Math.max(1, Math.floor(num(get('page')) ?? 1)),
  }
}

export type SearchResult = {
  intakeId: string
  mode: BookingMode
  reason?: UnavailableReason
  available: number
  distanceKm: number | null
  intake: Prisma.IntakeGetPayload<{
    include: { fees: true; courseType: { include: { branch: true; language: true } }; school: { select: { id: true; name: true; slug: true; status: true; instantBookingEnabled: true } } }
  }>
}

export async function searchCourses(filters: SearchFilters, now = new Date()) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`ct."publicationStatus"::text = 'PUBLISHED'`,
    Prisma.sql`s."status"::text IN ('VERIFIED', 'PARTNER')`,
    Prisma.sql`i."archivedAt" IS NULL`,
    Prisma.sql`i."startDate" >= ${now}::date`,
  ]

  let origin: { lat: number; lng: number } | null = null
  if (filters.postcode) origin = await geocodePostcode(filters.postcode)

  if (filters.format === 'ONLINE') {
    conditions.push(Prisma.sql`ct."format"::text = 'ONLINE'`)
  } else {
    if (filters.format) conditions.push(Prisma.sql`ct."format"::text = ${filters.format}`)
    if (filters.city && !origin) {
      const city = await findCityByName(filters.city)
      if (city) conditions.push(Prisma.sql`br."cityId" = ${city.id}`)
      else conditions.push(Prisma.sql`lower(br."cityName") = lower(${filters.city})`)
      if (!filters.format) conditions.push(Prisma.sql`ct."format"::text <> 'ONLINE'`)
    }
  }
  if (filters.language) conditions.push(Prisma.sql`ct."languageCode" = ${filters.language}`)
  if (filters.level) conditions.push(Prisma.sql`ct."level"::text = ${filters.level}`)
  if (filters.category) conditions.push(Prisma.sql`ct."category"::text = ${filters.category}`)
  if (filters.startFrom) conditions.push(Prisma.sql`i."startDate" >= ${filters.startFrom}::date`)
  if (filters.startTo) conditions.push(Prisma.sql`i."startDate" <= ${filters.startTo}::date`)
  if (filters.weekdays?.length) conditions.push(Prisma.sql`i."weekdays" <@ ${filters.weekdays}::int[]`)
  if (filters.timeOfDay === 'morning') conditions.push(Prisma.sql`i."startTime" < '12:00'`)
  if (filters.timeOfDay === 'afternoon') conditions.push(Prisma.sql`i."startTime" >= '12:00' AND i."startTime" < '17:00'`)
  if (filters.timeOfDay === 'evening') conditions.push(Prisma.sql`i."startTime" >= '17:00'`)
  if (filters.minWeeks !== undefined) conditions.push(Prisma.sql`(i."endDate" - i."startDate" + 1) >= ${Math.round(filters.minWeeks * 7)}`)
  if (filters.maxWeeks !== undefined) conditions.push(Prisma.sql`(i."endDate" - i."startDate" + 1) <= ${Math.round(filters.maxWeeks * 7)}`)
  if (filters.minLessons !== undefined) conditions.push(Prisma.sql`ct."lessonsPerWeek" >= ${Math.round(filters.minLessons)}`)
  if (filters.maxLessons !== undefined) conditions.push(Prisma.sql`ct."lessonsPerWeek" <= ${Math.round(filters.maxLessons)}`)
  if (filters.minPrice !== undefined) conditions.push(Prisma.sql`i."totalPriceCents" >= ${Math.round(filters.minPrice * 100)}`)
  if (filters.maxPrice !== undefined) conditions.push(Prisma.sql`i."totalPriceCents" <= ${Math.round(filters.maxPrice * 100)}`)

  const distance = origin
    ? Prisma.sql`CASE WHEN br."lat" IS NULL OR br."lng" IS NULL THEN NULL ELSE
        2 * 6371 * asin(sqrt(
          power(sin(radians(br."lat" - ${origin.lat}) / 2), 2) +
          cos(radians(${origin.lat})) * cos(radians(br."lat")) * power(sin(radians(br."lng" - ${origin.lng}) / 2), 2)
        )) END`
    : Prisma.sql`NULL::float8`

  const outer: Prisma.Sql[] = [Prisma.sql`TRUE`]
  if (filters.availableOnly || filters.instantOnly) outer.push(Prisma.sql`available > 0`)
  if (filters.instantOnly) outer.push(Prisma.sql`instant_candidate`)
  if (origin && filters.format !== 'ONLINE') {
    const radius = filters.radiusKm && filters.radiusKm > 0 ? filters.radiusKm : 25
    outer.push(Prisma.sql`(distance_km <= ${radius} OR online)`)
  }

  const order =
    filters.sort === 'price'
      ? Prisma.sql`"totalPriceCents" ASC, "startDate" ASC`
      : filters.sort === 'distance' && origin
        ? Prisma.sql`distance_km ASC NULLS LAST, "startDate" ASC`
        : Prisma.sql`"startDate" ASC, "totalPriceCents" ASC`

  const page = filters.page ?? 1
  const rows = await prisma.$queryRaw<{ id: string; available: bigint; distance_km: number | null; total: bigint }[]>`
    WITH base AS (
      SELECT
        i."id",
        i."startDate",
        i."totalPriceCents",
        (ct."format"::text = 'ONLINE') AS online,
        i."capacity"
          - (SELECT count(*) FROM "bookings" b WHERE b."intakeId" = i."id" AND b."status"::text = 'CONFIRMED')
          - (SELECT count(*) FROM "seat_holds" h WHERE h."intakeId" = i."id" AND h."status"::text = 'ACTIVE' AND h."expiresAt" > ${now})
          AS available,
        (s."status"::text = 'PARTNER' AND s."instantBookingEnabled" AND i."instantBooking" AND i."status"::text = 'OPEN'
          AND COALESCE(i."bookingDeadline", i."startDate"::timestamp) > ${now}) AS instant_candidate,
        ${distance} AS distance_km
      FROM "intakes" i
      JOIN "course_types" ct ON ct."id" = i."courseTypeId"
      JOIN "branches" br ON br."id" = ct."branchId"
      JOIN "schools" s ON s."id" = i."schoolId"
      WHERE ${Prisma.join(conditions, ' AND ')}
    )
    SELECT "id", available, distance_km, count(*) OVER () AS total
    FROM base
    WHERE ${Prisma.join(outer, ' AND ')}
    ORDER BY ${order}
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `

  const total = rows.length ? Number(rows[0].total) : 0
  const intakes = await prisma.intake.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    include: {
      fees: true,
      courseType: { include: { branch: true, language: true } },
      school: { select: { id: true, name: true, slug: true, status: true, instantBookingEnabled: true } },
    },
  })

  const results: SearchResult[] = rows.flatMap((row) => {
    const intake = intakes.find((i) => i.id === row.id)
    if (!intake) return []
    const available = Math.max(0, Number(row.available))
    const { mode, reason } = bookingMode({ school: intake.school, courseType: intake.courseType, intake, available, now })
    return [{ intakeId: intake.id, mode, reason, available, distanceKm: row.distance_km === null ? null : Number(row.distance_km), intake }]
  })

  return { results, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), originFound: !filters.postcode || !!origin }
}

export async function logSearch(filters: SearchFilters, resultCount: number, userId?: string | null) {
  try {
    await prisma.analyticsEvent.create({
      data: { type: 'search', userId: userId ?? null, data: { ...filters, resultCount } as Prisma.InputJsonValue },
    })
  } catch (error) {
    console.error('[search] could not log search', error)
  }
}
