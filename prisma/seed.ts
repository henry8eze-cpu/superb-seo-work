// Seeds reference data, and — only with `--demo` / SEED_DEMO=true — a demo
// marketplace with fictional schools, courses and bookings for local testing.
//
//   npm run db:seed          admin user + languages + NRW cities + postcode centroids
//   npm run db:seed:demo     the above plus demo schools, intakes and bookings
import 'dotenv/config'
import { PrismaClient, type Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { ensureSuperbSchool, migrateLegacy } from './legacy'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const DEMO = process.argv.includes('--demo') || process.env.SEED_DEMO === 'true'

// Research order from the brief: first five cities, then the rest of NRW.
const CITIES = [
  { name: 'Düsseldorf', slug: 'duesseldorf', priority: 1, lat: 51.2277, lng: 6.7735, postcode: '40210' },
  { name: 'Essen', slug: 'essen', priority: 2, lat: 51.4556, lng: 7.0116, postcode: '45127' },
  { name: 'Duisburg', slug: 'duisburg', priority: 3, lat: 51.4344, lng: 6.7623, postcode: '47051' },
  { name: 'Dortmund', slug: 'dortmund', priority: 4, lat: 51.5136, lng: 7.4653, postcode: '44137' },
  { name: 'Münster', slug: 'muenster', priority: 5, lat: 51.9607, lng: 7.6261, postcode: '48143' },
  { name: 'Köln', slug: 'koeln', priority: 10, lat: 50.9375, lng: 6.9603, postcode: '50667' },
  { name: 'Bochum', slug: 'bochum', priority: 11, lat: 51.4818, lng: 7.2162, postcode: '44787' },
  { name: 'Bonn', slug: 'bonn', priority: 12, lat: 50.7374, lng: 7.0982, postcode: '53111' },
  { name: 'Wuppertal', slug: 'wuppertal', priority: 13, lat: 51.2562, lng: 7.1508, postcode: '42103' },
  { name: 'Gelsenkirchen', slug: 'gelsenkirchen', priority: 14, lat: 51.5177, lng: 7.0857, postcode: '45879' },
  { name: 'Oberhausen', slug: 'oberhausen', priority: 15, lat: 51.4963, lng: 6.8638, postcode: '46045' },
]

const LANGUAGES = [
  { code: 'de', nameEn: 'German', nameDe: 'Deutsch', active: true, sortOrder: 1 },
  { code: 'en', nameEn: 'English', nameDe: 'Englisch', active: false, sortOrder: 2 },
  { code: 'es', nameEn: 'Spanish', nameDe: 'Spanisch', active: false, sortOrder: 3 },
  { code: 'fr', nameEn: 'French', nameDe: 'Französisch', active: false, sortOrder: 4 },
  { code: 'tr', nameEn: 'Turkish', nameDe: 'Türkisch', active: false, sortOrder: 5 },
]

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@superb-sprachschule.de'
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!'
  const name = process.env.ADMIN_NAME || 'Admin'
  const hashedPassword = await bcrypt.hash(password, 10)
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'PLATFORM_ADMIN', password: hashedPassword },
    create: { email, name, password: hashedPassword, role: 'PLATFORM_ADMIN' },
  })
  console.log(`Admin user ready: ${admin.email} (role: ${admin.role})`)
  return admin
}

async function seedReferenceData() {
  for (const language of LANGUAGES) {
    await prisma.language.upsert({ where: { code: language.code }, update: {}, create: language })
  }
  for (const { postcode, ...city } of CITIES) {
    await prisma.city.upsert({ where: { slug: city.slug }, update: { lat: city.lat, lng: city.lng }, create: city })
    // City-centre centroid so postcode search works before the full GeoNames import (scripts/import-postcodes.ts).
    await prisma.postcodeLocation.upsert({ where: { postcode }, update: {}, create: { postcode, place: city.name, lat: city.lat, lng: city.lng } })
  }
  console.log(`Reference data: ${LANGUAGES.length} languages, ${CITIES.length} cities.`)
}

// ---------------------------------------------------------------------------
// Demo data (fictional schools; example.org addresses)
// ---------------------------------------------------------------------------

function day(offset: number) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + offset)
  return d
}

/** Next Monday at least `minDays` from today. */
function nextMonday(minDays: number) {
  const d = day(minDays)
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1)
  return d
}

type DemoSchool = {
  slug: string
  name: string
  city: string
  status: 'DISCOVERED' | 'VERIFIED' | 'PARTNER' | 'INACTIVE'
  type?: 'PRIVATE' | 'VHS' | 'NON_PROFIT'
  instant?: boolean
  payAtSchool?: boolean
  owner?: string
  address?: string
  postcode?: string
  phone?: string
}

const DEMO_SCHOOLS: DemoSchool[] = [
  { slug: 'deutschwerk-duesseldorf', name: 'Deutschwerk Düsseldorf', city: 'Düsseldorf', status: 'PARTNER', instant: true, owner: 'owner.deutschwerk@example.org', address: 'Beispielallee 12', postcode: '40210', phone: '0211 5550100' },
  { slug: 'sprachhaus-rhein-duisburg', name: 'Sprachhaus Rhein', city: 'Duisburg', status: 'PARTNER', instant: false, payAtSchool: true, owner: 'owner.sprachhaus@example.org', address: 'Musterstraße 3', postcode: '47051', phone: '0203 5550200' },
  { slug: 'lingua-campus-dortmund', name: 'Lingua Campus Dortmund', city: 'Dortmund', status: 'PARTNER', instant: true, payAtSchool: true, owner: 'owner.lingua@example.org', address: 'Probeweg 8', postcode: '44137', phone: '0231 5550300' },
  { slug: 'vhs-beispiel-muenster', name: 'Volkshochschule Beispielstadt', city: 'Münster', status: 'VERIFIED', type: 'VHS', address: 'Am Beispielplatz 1', postcode: '48143', phone: '0251 5550400' },
  { slug: 'sprachtreff-essen', name: 'Sprachtreff Essen e.V.', city: 'Essen', status: 'VERIFIED', type: 'NON_PROFIT', address: 'Vereinsweg 2', postcode: '45127', phone: '0201 5550500' },
  { slug: 'alpha-sprachen-duesseldorf', name: 'Alpha Sprachen', city: 'Düsseldorf', status: 'DISCOVERED', phone: '0211 5550600' },
  { slug: 'alpha-sprachschule-duesseldorf', name: 'Alpha Sprachschule GmbH', city: 'Düsseldorf', status: 'DISCOVERED', phone: '0211 5550600' },
  { slug: 'wortwerk-essen', name: 'Wortwerk Essen', city: 'Essen', status: 'DISCOVERED' },
  { slug: 'deutsch-direkt-dortmund', name: 'Deutsch Direkt', city: 'Dortmund', status: 'DISCOVERED' },
  { slug: 'kursbruecke-muenster', name: 'Kursbrücke Münster', city: 'Münster', status: 'DISCOVERED' },
  { slug: 'hafenschule-duisburg', name: 'Hafenschule Duisburg', city: 'Duisburg', status: 'INACTIVE' },
]

async function seedDemo(adminId: string) {
  const password = await bcrypt.hash(process.env.SEED_PASSWORD || 'ChangeMe123!', 10)
  const cities = new Map((await prisma.city.findMany()).map((c) => [c.name, c]))

  const student = await prisma.user.upsert({
    where: { email: 'student@example.org' },
    update: {},
    create: { email: 'student@example.org', name: 'Demo Student', password, role: 'STUDENT', student: { create: {} } },
  })

  for (const def of DEMO_SCHOOLS) {
    const city = cities.get(def.city)!
    const domain = `${def.slug}.example.org`
    const school = await prisma.school.upsert({
      where: { slug: def.slug },
      update: {},
      create: {
        slug: def.slug,
        name: def.name,
        nameNormalized: def.name.toLowerCase().replace(/ gmbh| e\.v\./g, '').replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae'),
        website: def.slug.startsWith('alpha') ? 'https://alpha-sprachen.example.org' : `https://${domain}`,
        websiteDomain: def.slug.startsWith('alpha') ? 'alpha-sprachen.example.org' : domain,
        publicEmail: `info@${domain}`,
        phone: def.phone,
        phoneNormalized: def.phone ? `49${def.phone.replace(/\D/g, '').slice(1)}` : null,
        schoolType: def.type ?? 'PRIVATE',
        languagesOffered: ['de'],
        courseTypesOffered: ['STANDARD', 'INTENSIVE', 'EVENING'],
        cityId: city.id,
        status: def.status,
        onboardingStage: def.status === 'PARTNER' ? 'ONBOARDED' : def.status === 'VERIFIED' ? 'CONTACTED' : 'NOT_CONTACTED',
        instantBookingEnabled: def.status === 'PARTNER' && !!def.instant,
        allowPayAtSchool: !!def.payAtSchool,
        verifiedAt: def.status === 'PARTNER' || def.status === 'VERIFIED' ? day(-20) : null,
        partnerSince: def.status === 'PARTNER' ? day(-10) : null,
        lastCheckedAt: day(-5),
        inactiveReason: def.status === 'INACTIVE' ? 'Closed (demo)' : null,
        description: def.status === 'PARTNER' ? `${def.name} bietet Deutschkurse von A1 bis C1 in kleinen Gruppen.` : null,
        sources: { create: [{ url: `https://${domain}/impressum`, sourceType: 'SCHOOL_WEBSITE', retrievedAt: day(-5), createdById: adminId }] },
      },
    })
    if (def.status === 'DISCOVERED' || def.status === 'INACTIVE') continue
    if (await prisma.courseType.count({ where: { schoolId: school.id } })) continue

    const branch = await prisma.branch.create({
      data: { schoolId: school.id, name: def.city, address: def.address, postcode: def.postcode, cityName: def.city, cityId: city.id, lat: city.lat, lng: city.lng },
    })
    const online = await prisma.branch.create({ data: { schoolId: school.id, name: 'Online', isOnline: true } })

    if (def.owner) {
      const owner = await prisma.user.upsert({
        where: { email: def.owner },
        update: {},
        create: { email: def.owner, name: `Inhaber:in ${def.name}`, password, role: 'SCHOOL_USER' },
      })
      await prisma.schoolMembership.create({ data: { schoolId: school.id, userId: owner.id, role: 'OWNER' } })
      await prisma.commissionTerms.create({
        data: { schoolId: school.id, type: 'FIXED', fixedCents: 8_000, note: 'Test assumption – not a final price', createdById: adminId, validFrom: day(-10) },
      })
      await prisma.subscription.create({ data: { schoolId: school.id, monthlyPriceCents: 9_900, status: 'TRIAL', startedAt: day(-10), note: 'Test assumption' } })
    }

    const terms = 'Kostenlose Stornierung bis 14 Tage vor Kursbeginn, danach 50 % der Kursgebühr. / Free cancellation up to 14 days before the start, afterwards 50 %.'
    const courseDefs: { name: string; level: Prisma.CourseTypeCreateInput['level']; category: Prisma.CourseTypeCreateInput['category']; format: 'IN_PERSON' | 'ONLINE'; lessons: number; weekdays: number[]; start: string; end: string; price: number; weeks: number }[] = [
      { name: 'Deutsch A1 Intensivkurs', level: 'A1', category: 'INTENSIVE', format: 'IN_PERSON', lessons: 20, weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '12:15', price: 49_000, weeks: 4 },
      { name: 'Deutsch A2 Abendkurs', level: 'A2', category: 'EVENING', format: 'IN_PERSON', lessons: 6, weekdays: [2, 4], start: '18:00', end: '20:15', price: 39_000, weeks: 10 },
      { name: 'Deutsch B1 Online', level: 'B1', category: 'STANDARD', format: 'ONLINE', lessons: 8, weekdays: [1, 3], start: '17:30', end: '19:45', price: 42_000, weeks: 8 },
      { name: 'Telc B2 Prüfungsvorbereitung', level: 'B2', category: 'EXAM_PREP', format: 'IN_PERSON', lessons: 8, weekdays: [6], start: '10:00', end: '16:00', price: 35_000, weeks: 6 },
    ]
    for (const [i, def2] of courseDefs.entries()) {
      const courseType = await prisma.courseType.create({
        data: {
          schoolId: school.id,
          branchId: def2.format === 'ONLINE' ? online.id : branch.id,
          name: def2.name,
          level: def2.level,
          category: def2.category,
          format: def2.format,
          lessonsPerWeek: def2.lessons,
          cancellationTerms: terms,
          description: 'Kleine Gruppen (max. 12), erfahrene Lehrkräfte, Lehrbuch im Kurs. / Small groups, experienced teachers.',
          publicationStatus: i === 3 && def.status === 'PARTNER' ? 'PENDING_APPROVAL' : 'PUBLISHED',
          submittedAt: day(-3),
        },
      })
      // Two dated intakes per course, e.g. an October and a November start.
      for (const [n, offset] of [14 + i * 3, 45 + i * 3].entries()) {
        const start = nextMonday(offset)
        const end = new Date(start.getTime() + (def2.weeks * 7 - 3) * 86_400_000)
        const capacity = i === 0 && n === 0 ? 3 : 12
        await prisma.intake.create({
          data: {
            courseTypeId: courseType.id,
            schoolId: school.id,
            startDate: start,
            endDate: end,
            weekdays: def2.weekdays,
            startTime: def2.start,
            endTime: def2.end,
            priceCents: def2.price,
            totalPriceCents: def2.price + 3_500,
            capacity,
            lastConfirmedAt: day(-(i + n * 20)),
            fees: { create: [{ label: 'Lehrbuch / Coursebook', amountCents: 3_500 }, { label: 'Prüfungsgebühr (optional)', amountCents: 18_000, compulsory: false }] },
          },
        })
      }
    }

    // A few existing students, so dashboards and seat counts are not empty.
    const firstIntake = await prisma.intake.findFirst({ where: { schoolId: school.id }, orderBy: { startDate: 'asc' } })
    if (firstIntake && def.owner) {
      await prisma.booking.create({
        data: {
          reference: `DEMO-${def.slug.slice(0, 4).toUpperCase()}1`,
          intakeId: firstIntake.id,
          schoolId: school.id,
          channel: 'DIRECT',
          status: 'CONFIRMED',
          confirmedAt: day(-2),
          studentName: 'Ana Beispiel',
          studentEmail: `ana.${def.slug}@example.org`,
          priceCents: firstIntake.priceCents,
          feesCents: firstIntake.totalPriceCents - firstIntake.priceCents,
          totalCents: firstIntake.totalPriceCents,
          payments: { create: { schoolId: school.id, amountCents: 20_000, method: 'BANK_TRANSFER' } },
        },
      })
      await prisma.enquiry.create({
        data: { schoolId: school.id, intakeId: firstIntake.id, courseTypeId: firstIntake.courseTypeId, name: 'Omar Muster', email: 'omar@example.org', message: 'Gibt es einen Einstufungstest vor Kursbeginn?' },
      })
    }
  }

  // The duplicate pair above, flagged for review.
  const [a, b] = await Promise.all([
    prisma.school.findUnique({ where: { slug: 'alpha-sprachen-duesseldorf' } }),
    prisma.school.findUnique({ where: { slug: 'alpha-sprachschule-duesseldorf' } }),
  ])
  if (a && b && !(await prisma.duplicateCandidate.count({ where: { schoolId: b.id } }))) {
    await prisma.duplicateCandidate.create({ data: { schoolId: b.id, otherSchoolId: a.id, score: 100, reasons: ['domain', 'phone', 'similar_name'] } })
  }

  // Superb itself, with its legacy courses moved over.
  const { school: superb } = await ensureSuperbSchool(prisma)
  await prisma.schoolMembership.upsert({
    where: { schoolId_userId: { schoolId: superb.id, userId: adminId } },
    update: {},
    create: { schoolId: superb.id, userId: adminId, role: 'OWNER' },
  })

  console.log(`Demo data ready. Logins (password: ${process.env.SEED_PASSWORD ? '$SEED_PASSWORD' : 'ChangeMe123!'}):`)
  console.log(`  student: ${student.email}`)
  for (const s of DEMO_SCHOOLS.filter((d) => d.owner)) console.log(`  school owner: ${s.owner} (${s.name})`)
}

async function main() {
  const admin = await seedAdmin()
  await seedReferenceData()
  if (DEMO) await seedDemo(admin.id)
  await migrateLegacy(prisma)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
