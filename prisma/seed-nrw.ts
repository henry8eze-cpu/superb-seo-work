// Loads the researched NRW schools (prisma/data/nrw-schools.ts) into the database.
//
//   npm run db:seed:nrw
//
// Idempotent and non-destructive: existing schools (matched by slug) are left as
// they are, so edits made in the admin are never overwritten. Missing sources,
// branches, courses and intakes are added. Requires `npm run db:seed` first (cities).
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { CHECKED_ON, NRW_SCHOOLS } from './data/nrw-schools'
import { normalizeDomain, normalizeName, normalizePhone } from '../lib/schools/normalize'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
const day = (value: string) => new Date(`${value}T00:00:00.000Z`)

async function main() {
  const checkedOn = day(CHECKED_ON)
  const cities = new Map((await prisma.city.findMany()).map((c) => [c.name, c]))
  await prisma.language.upsert({ where: { code: 'de' }, update: {}, create: { code: 'de', nameEn: 'German', nameDe: 'Deutsch', sortOrder: 1 } })
  const counts = { schools: 0, sources: 0, branches: 0, courses: 0, intakes: 0 }

  for (const def of NRW_SCHOOLS) {
    const city = cities.get(def.city)
    if (!city) throw new Error(`City ${def.city} missing – run npm run db:seed first`)

    let school = await prisma.school.findUnique({ where: { slug: def.slug } })
    if (!school) {
      school = await prisma.school.create({
        data: {
          slug: def.slug,
          name: def.name,
          legalName: def.legalName,
          nameNormalized: normalizeName(def.name),
          website: def.website,
          websiteDomain: normalizeDomain(def.website),
          publicEmail: def.publicEmail,
          phone: def.phone,
          phoneNormalized: normalizePhone(def.phone),
          schoolType: def.schoolType,
          languagesOffered: ['de'],
          courseTypesOffered: def.courseTypesOffered,
          cityId: city.id,
          status: def.status,
          verifiedAt: def.status === 'VERIFIED' ? checkedOn : null,
          lastCheckedAt: checkedOn,
          description: def.description,
        },
      })
      await prisma.auditEvent.create({
        data: { actorType: 'SYSTEM', schoolId: school.id, entity: 'School', entityId: school.id, action: 'school.imported', after: { source: def.sourceUrl, status: def.status } },
      })
      counts.schools++
    }

    if (!(await prisma.researchSource.findFirst({ where: { schoolId: school.id, url: def.sourceUrl } }))) {
      await prisma.researchSource.create({
        data: { schoolId: school.id, url: def.sourceUrl, sourceType: def.sourceType, retrievedAt: checkedOn, notes: def.sourceNotes },
      })
      counts.sources++
    }

    const branchIds: string[] = []
    for (const b of def.branches) {
      let branch = await prisma.branch.findFirst({ where: { schoolId: school.id, name: b.name } })
      if (!branch) {
        const branchCity = cities.get(b.cityName)
        branch = await prisma.branch.create({
          data: {
            schoolId: school.id,
            name: b.name,
            isOnline: !!b.isOnline,
            address: b.isOnline ? null : b.address,
            postcode: b.isOnline ? null : b.postcode,
            cityName: b.isOnline ? null : b.cityName,
            cityId: b.isOnline ? null : branchCity?.id,
            lat: b.isOnline ? null : branchCity?.lat,
            lng: b.isOnline ? null : branchCity?.lng,
          },
        })
        counts.branches++
      }
      branchIds.push(branch.id)
    }

    for (const c of def.courses ?? []) {
      let courseType = await prisma.courseType.findFirst({ where: { schoolId: school.id, name: c.name } })
      if (!courseType) {
        courseType = await prisma.courseType.create({
          data: {
            schoolId: school.id,
            branchId: branchIds[c.branch],
            name: c.name,
            languageCode: 'de',
            level: c.level,
            category: c.category,
            format: c.format,
            description: `${c.description}\n\nQuelle / Source: ${c.sourceUrl}`,
            lessonsPerWeek: c.sessionsPerWeek,
            lessonMinutes: c.sessionMinutes,
            cancellationTerms: def.cancellationTerms ?? 'Es gelten die Geschäftsbedingungen der Schule.',
            publicationStatus: 'PUBLISHED',
            submittedAt: checkedOn,
            reviewedAt: checkedOn,
          },
        })
        counts.courses++
      }
      const start = day(c.startDate)
      if (!(await prisma.intake.findFirst({ where: { courseTypeId: courseType.id, startDate: start } }))) {
        await prisma.intake.create({
          data: {
            courseTypeId: courseType.id,
            schoolId: school.id,
            startDate: start,
            endDate: day(c.endDate),
            weekdays: c.weekdays,
            startTime: c.startTime,
            endTime: c.endTime,
            priceCents: c.priceCents,
            totalPriceCents: c.priceCents,
            capacity: c.capacity,
            // Not a partner: enquiry only. Waitlist-only courses on the school's site are shown as full.
            instantBooking: false,
            status: c.full ? 'FULL' : 'OPEN',
            lastConfirmedAt: checkedOn,
          },
        })
        counts.intakes++
      }
    }
  }

  console.log(
    `NRW data: ${counts.schools} schools, ${counts.sources} sources, ${counts.branches} branches, ${counts.courses} courses and ${counts.intakes} intakes added (of ${NRW_SCHOOLS.length} schools in the data file).`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
