// Live numbers and previews for the landing page and the public school directory.
// Only VERIFIED and PARTNER schools are ever shown publicly.

import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { searchCourses } from './search'
import { getAvailability } from '../booking/inventory'
import { bookingMode } from '../booking/rules'
import { cachedPublic } from '../public-cache'

export const LISTED_STATUSES = ['VERIFIED', 'PARTNER'] as const

/** Published, upcoming, not archived intakes of listed schools. */
function upcomingIntakeWhere(now: Date): Prisma.IntakeWhereInput {
  return {
    archivedAt: null,
    startDate: { gte: new Date(now.toISOString().slice(0, 10)) },
    courseType: { publicationStatus: 'PUBLISHED' },
    school: { status: { in: [...LISTED_STATUSES] } },
  }
}

export type CityStat = { name: string; slug: string; schools: number; courses: number; minPriceCents: number | null }

export async function getLandingData(now = new Date()) {
  const [intakes, cities, listedSchools, all, instant, evening, online] = await Promise.all([
    prisma.intake.findMany({
      where: upcomingIntakeWhere(now),
      select: {
        id: true,
        status: true,
        totalPriceCents: true,
        courseType: { select: { level: true, category: true, format: true, branch: { select: { cityId: true, isOnline: true } } } },
      },
    }),
    prisma.city.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] }),
    prisma.school.findMany({
      where: { status: { in: [...LISTED_STATUSES] } },
      select: { id: true, cityId: true, branches: { where: { archivedAt: null }, select: { cityId: true } } },
    }),
    searchCourses({ sort: 'start' }, now),
    searchCourses({ sort: 'start', instantOnly: true }, now),
    searchCourses({ sort: 'start', timeOfDay: 'evening' }, now),
    searchCourses({ sort: 'start', format: 'ONLINE' }, now),
  ])

  const open = intakes.filter((i) => i.status !== 'CLOSED')

  const cityStats: CityStat[] = cities.map((city) => {
    const here = open.filter((i) => !i.courseType.branch.isOnline && i.courseType.branch.cityId === city.id)
    const schools = listedSchools.filter((s) => s.cityId === city.id || s.branches.some((b) => b.cityId === city.id)).length
    return {
      name: city.name,
      slug: city.slug,
      schools,
      courses: here.length,
      minPriceCents: here.length ? Math.min(...here.map((i) => i.totalPriceCents)) : null,
    }
  })

  const countBy = <K extends string>(key: (i: (typeof open)[number]) => K) => {
    const map: Partial<Record<K, number>> = {}
    for (const i of open) map[key(i)] = (map[key(i)] ?? 0) + 1
    return map
  }

  const upcoming = (list: typeof all.results) => list.filter((r) => r.mode !== 'UNAVAILABLE').slice(0, 6)

  return {
    cityStats,
    levelCounts: countBy((i) => i.courseType.level),
    categoryCounts: countBy((i) => i.courseType.category),
    onlineCount: open.filter((i) => i.courseType.format === 'ONLINE' || i.courseType.branch.isOnline).length,
    tabs: {
      all: upcoming(all.results),
      instant: upcoming(instant.results),
      evening: upcoming(evening.results),
      online: upcoming(online.results),
    },
  }
}

export type DirectorySchool = Awaited<ReturnType<typeof getDirectorySchools>>[number]

/** Listed schools with their next dates, partners first. */
export async function getDirectorySchools(options: { citySlug?: string; take?: number } = {}, now = new Date()) {
  const city = options.citySlug ? await prisma.city.findUnique({ where: { slug: options.citySlug } }) : null
  const schools = await prisma.school.findMany({
    where: {
      status: { in: [...LISTED_STATUSES] },
      ...(city ? { OR: [{ cityId: city.id }, { branches: { some: { cityId: city.id, archivedAt: null } } }] } : {}),
    },
    include: {
      city: { select: { name: true } },
      intakes: {
        where: upcomingIntakeWhere(now),
        orderBy: { startDate: 'asc' },
        select: { id: true, startDate: true, status: true },
      },
    },
    orderBy: [{ status: 'desc' }, { name: 'asc' }],
    take: options.take,
  })
  return schools
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      city: s.city?.name ?? null,
      schoolType: s.schoolType,
      partner: s.status === 'PARTNER',
      instant: s.status === 'PARTNER' && s.instantBookingEnabled,
      courseTypesOffered: s.courseTypesOffered,
      upcoming: s.intakes.filter((i) => i.status !== 'CLOSED').length,
      nextStart: s.intakes[0]?.startDate ?? null,
    }))
    .sort((a, b) => Number(b.partner) - Number(a.partner) || b.upcoming - a.upcoming || a.name.localeCompare(b.name))
}

export async function getPublicSchool(slug: string, now = new Date()) {
  const school = await prisma.school.findUnique({
    where: { slug },
    include: {
      city: true,
      branches: { where: { archivedAt: null }, orderBy: { name: 'asc' } },
      sources: { orderBy: { retrievedAt: 'desc' }, take: 1 },
      intakes: {
        where: upcomingIntakeWhere(now),
        orderBy: { startDate: 'asc' },
        include: { fees: true, courseType: { include: { branch: true, language: true } } },
      },
    },
  })
  if (!school || !(LISTED_STATUSES as readonly string[]).includes(school.status)) return null
  const availability = await getAvailability(school.intakes.map((i) => i.id), now)
  const intakes = school.intakes.map((intake) => {
    const available = availability.get(intake.id)?.available ?? 0
    const { mode, reason } = bookingMode({ school, courseType: intake.courseType, intake, available, now })
    return { intake, mode, reason, available }
  })
  return { school, intakes }
}

// ---------------------------------------------------------------------------
// Cached versions for public pages (see lib/public-cache.ts)
// ---------------------------------------------------------------------------

export const getLandingDataCached = cachedPublic('landing', () => getLandingData())

export const getDirectorySchoolsCached = cachedPublic('directory', (citySlug: string | null, take: number | null) =>
  getDirectorySchools({ citySlug: citySlug ?? undefined, take: take ?? undefined })
)

export const getPublicSchoolCached = cachedPublic('school', (slug: string) => getPublicSchool(slug))

/** Cities with at least one listed school, for the directory filter. */
export const getDirectoryCitiesCached = cachedPublic('directory-cities', () =>
  prisma.city.findMany({
    where: {
      OR: [
        { schools: { some: { status: { in: [...LISTED_STATUSES] } } } },
        { branches: { some: { school: { status: { in: [...LISTED_STATUSES] } } } } },
      ],
    },
    orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    select: { name: true, slug: true },
  })
)

/** Cities and active languages for the search filters. */
export const getSearchFilterOptionsCached = cachedPublic('search-filters', async () => {
  const [cities, languages] = await Promise.all([
    prisma.city.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }], select: { name: true } }),
    prisma.language.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ])
  return { cities, languages }
})
