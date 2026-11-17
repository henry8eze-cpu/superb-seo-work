// Internal admin: building and verifying the NRW school database.

import type { Prisma, School, SchoolStatus } from '@prisma/client'
import { prisma } from '../prisma'
import { audit, diff } from '../audit'
import { AppError } from '../errors'
import { assertPlatformAdmin, type Actor } from '../permissions'
import { locateBranch, findCityByName } from '../geo'
import {
  DUPLICATE_THRESHOLD,
  normalizeDomain,
  normalizeName,
  normalizePhone,
  normalizePostcode,
  normalizeUrl,
  scoreDuplicate,
  slugify,
  type DuplicateComparable,
} from '../schools/normalize'
import { parseCsvRecords } from '../csv'
import {
  branchSchema,
  citySchema,
  contactAttemptSchema,
  researchSourceSchema,
  schoolDetailsSchema,
  staffContactSchema,
  COURSE_CATEGORIES,
  SCHOOL_TYPES,
  SOURCE_TYPES,
  type BranchInput,
  type ContactAttemptInput,
  type ResearchSourceInput,
  type SchoolDetailsInput,
  type StaffContactInput,
} from '../validation/schools'

type Db = Prisma.TransactionClient | typeof prisma

export type SchoolTypeValue = (typeof SCHOOL_TYPES)[number]
export type CourseCategoryValue = (typeof COURSE_CATEGORIES)[number]
export type SourceTypeValue = (typeof SOURCE_TYPES)[number]
export type ContactChannelValue = ContactAttemptInput['channel']
export type ContactOutcomeValue = ContactAttemptInput['outcome']

export async function uniqueSchoolSlug(db: Db, name: string, cityName?: string | null) {
  const base = slugify(cityName ? `${name} ${cityName}` : name) || 'school'
  let slug = base
  for (let i = 2; await db.school.findUnique({ where: { slug }, select: { id: true } }); i++) {
    slug = `${base}-${i}`
  }
  return slug
}

function derivedFields(input: { name: string; website?: string | null; phone?: string | null }) {
  return {
    nameNormalized: normalizeName(input.name),
    websiteDomain: normalizeDomain(input.website),
    phoneNormalized: normalizePhone(input.phone),
  }
}

// ---------------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------------

export async function createCity(actor: Actor, input: unknown) {
  assertPlatformAdmin(actor)
  const data = citySchema.parse(input)
  const existing = await findCityByName(data.name)
  if (existing) throw new AppError('CONFLICT', 'City already exists')
  return prisma.city.create({ data: { name: data.name, slug: slugify(data.name), priority: data.priority } })
}

export async function setCityResearchStatus(actor: Actor, cityId: string, status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE') {
  assertPlatformAdmin(actor)
  return prisma.city.update({ where: { id: cityId }, data: { researchStatus: status } })
}

export type CityCoverage = {
  id: string
  name: string
  slug: string
  priority: number
  researchStatus: string
  total: number
  discovered: number
  verified: number
  partner: number
  inactive: number
  contacted: number
  invited: number
}

/** Per-city counts for the coverage dashboard. */
export async function getCityCoverage(): Promise<CityCoverage[]> {
  const [cities, byStatus, contacted, invited] = await Promise.all([
    prisma.city.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] }),
    prisma.school.groupBy({ by: ['cityId', 'status'], _count: { _all: true } }),
    prisma.school.groupBy({
      by: ['cityId'],
      where: { onboardingStage: { not: 'NOT_CONTACTED' }, status: { not: 'INACTIVE' } },
      _count: { _all: true },
    }),
    prisma.school.groupBy({
      by: ['cityId'],
      where: { onboardingStage: { in: ['INVITED', 'CLAIM_PENDING', 'ONBOARDED'] }, status: { not: 'INACTIVE' } },
      _count: { _all: true },
    }),
  ])

  return cities.map((city) => {
    const count = (status: SchoolStatus) =>
      byStatus.find((row) => row.cityId === city.id && row.status === status)?._count._all ?? 0
    const discovered = count('DISCOVERED')
    const verified = count('VERIFIED')
    const partner = count('PARTNER')
    const inactive = count('INACTIVE')
    return {
      id: city.id,
      name: city.name,
      slug: city.slug,
      priority: city.priority,
      researchStatus: city.researchStatus,
      total: discovered + verified + partner + inactive,
      discovered,
      verified,
      partner,
      inactive,
      contacted: contacted.find((row) => row.cityId === city.id)?._count._all ?? 0,
      invited: invited.find((row) => row.cityId === city.id)?._count._all ?? 0,
    }
  })
}

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------

export async function createSchool(actor: Actor, input: SchoolDetailsInput, source?: ResearchSourceInput) {
  assertPlatformAdmin(actor)
  const data = schoolDetailsSchema.parse(input)
  const sourceData = source ? researchSourceSchema.parse(source) : null

  return prisma.$transaction(async (tx) => {
    const city = data.cityId ? await tx.city.findUnique({ where: { id: data.cityId } }) : null
    const school = await tx.school.create({
      data: {
        slug: await uniqueSchoolSlug(tx, data.name, city?.name),
        name: data.name,
        legalName: data.legalName,
        description: data.description,
        website: normalizeUrl(data.website),
        publicEmail: data.publicEmail?.toLowerCase(),
        phone: data.phone,
        schoolType: data.schoolType,
        cityId: city?.id,
        languagesOffered: data.languagesOffered,
        courseTypesOffered: data.courseTypesOffered,
        lastCheckedAt: sourceData ? new Date() : null,
        ...derivedFields(data),
      },
    })
    if (sourceData && (sourceData.url || sourceData.notes)) {
      await tx.researchSource.create({
        data: {
          schoolId: school.id,
          field: sourceData.field,
          url: sourceData.url,
          sourceType: sourceData.sourceType,
          retrievedAt: sourceData.retrievedAt ? new Date(sourceData.retrievedAt) : new Date(),
          notes: sourceData.notes,
          createdById: actor.userId,
        },
      })
    }
    await audit(tx, { actorId: actor.userId, schoolId: school.id, entity: 'School', entityId: school.id, action: 'school.created', after: { name: school.name, status: school.status } })
    await flagDuplicates(tx, school.id)
    return school
  })
}

export async function updateSchoolDetails(actor: Actor, schoolId: string, input: SchoolDetailsInput) {
  assertPlatformAdmin(actor)
  const data = schoolDetailsSchema.parse(input)

  return prisma.$transaction(async (tx) => {
    const school = await tx.school.findUnique({ where: { id: schoolId } })
    if (!school) throw new AppError('NOT_FOUND')
    const next = {
      name: data.name,
      legalName: data.legalName ?? null,
      description: data.description ?? null,
      website: normalizeUrl(data.website),
      publicEmail: data.publicEmail?.toLowerCase() ?? null,
      phone: data.phone ?? null,
      schoolType: data.schoolType,
      cityId: data.cityId ?? null,
      languagesOffered: data.languagesOffered,
      courseTypesOffered: data.courseTypesOffered,
      ...derivedFields(data),
    }
    const changes = diff(school as unknown as Record<string, unknown>, next)
    if (!changes.changed) return school
    const updated = await tx.school.update({ where: { id: schoolId }, data: next })
    await audit(tx, { actorId: actor.userId, schoolId, entity: 'School', entityId: schoolId, action: 'school.updated', before: changes.before, after: changes.after })
    await flagDuplicates(tx, schoolId)
    return updated
  })
}

async function changeStatus(
  tx: Prisma.TransactionClient,
  actor: Actor,
  school: School,
  status: SchoolStatus,
  extra: Prisma.SchoolUpdateInput = {},
  action = 'school.status_changed'
) {
  const data: Prisma.SchoolUpdateInput = { status, ...extra }
  // Leaving PARTNER always switches instant booking off (the DB constraint requires it).
  if (status !== 'PARTNER') data.instantBookingEnabled = false
  const updated = await tx.school.update({ where: { id: school.id }, data })
  await audit(tx, {
    actorId: actor.userId,
    schoolId: school.id,
    entity: 'School',
    entityId: school.id,
    action,
    before: { status: school.status, instantBookingEnabled: school.instantBookingEnabled },
    after: { status: updated.status, instantBookingEnabled: updated.instantBookingEnabled, ...(extra.inactiveReason ? { inactiveReason: extra.inactiveReason } : {}) },
  })
  return updated
}

/** DISCOVERED → VERIFIED. Requires at least one recorded source. */
export async function verifySchool(actor: Actor, schoolId: string, input: { legalName?: string }) {
  assertPlatformAdmin(actor)
  return prisma.$transaction(async (tx) => {
    const school = await tx.school.findUnique({ where: { id: schoolId }, include: { _count: { select: { sources: true } } } })
    if (!school) throw new AppError('NOT_FOUND')
    if (school.status !== 'DISCOVERED' && school.status !== 'INACTIVE') {
      throw new AppError('CONFLICT', 'Only discovered or inactive schools can be verified')
    }
    if (school._count.sources === 0) throw new AppError('VALIDATION', 'Add at least one source before verifying')
    const now = new Date()
    return changeStatus(
      tx,
      actor,
      school,
      'VERIFIED',
      {
        legalName: input.legalName?.trim() || school.legalName,
        verifiedAt: now,
        verifiedBy: { connect: { id: actor.userId } },
        lastCheckedAt: now,
        inactiveReason: null,
      },
      'school.verified'
    )
  })
}

export async function markSchoolInactive(actor: Actor, schoolId: string, reason: string) {
  assertPlatformAdmin(actor)
  if (!reason.trim()) throw new AppError('VALIDATION', 'A reason is required')
  return prisma.$transaction(async (tx) => {
    const school = await tx.school.findUnique({ where: { id: schoolId } })
    if (!school) throw new AppError('NOT_FOUND')
    const updated = await changeStatus(tx, actor, school, 'INACTIVE', { inactiveReason: reason.trim() }, 'school.deactivated')
    // Take its courses off the marketplace.
    await tx.intake.updateMany({ where: { schoolId, status: 'OPEN' }, data: { status: 'CLOSED' } })
    return updated
  })
}

export async function reactivateSchool(actor: Actor, schoolId: string) {
  assertPlatformAdmin(actor)
  return prisma.$transaction(async (tx) => {
    const school = await tx.school.findUnique({ where: { id: schoolId } })
    if (!school) throw new AppError('NOT_FOUND')
    if (school.status !== 'INACTIVE') throw new AppError('CONFLICT')
    if (school.mergedIntoId) throw new AppError('CONFLICT', 'Merged records cannot be reactivated')
    const status: SchoolStatus = school.partnerSince ? 'PARTNER' : school.verifiedAt ? 'VERIFIED' : 'DISCOVERED'
    return changeStatus(tx, actor, school, status, { inactiveReason: null }, 'school.reactivated')
  })
}

/** Records that the team re-checked the school's public details today. */
export async function markSchoolChecked(actor: Actor, schoolId: string) {
  assertPlatformAdmin(actor)
  return prisma.school.update({ where: { id: schoolId }, data: { lastCheckedAt: new Date() } })
}

export async function addResearchSource(actor: Actor, schoolId: string, input: ResearchSourceInput) {
  assertPlatformAdmin(actor)
  const data = researchSourceSchema.parse(input)
  if (!data.url && !data.notes) throw new AppError('VALIDATION', 'Add a link or a note')
  const retrievedAt = data.retrievedAt ? new Date(data.retrievedAt) : new Date()
  return prisma.$transaction(async (tx) => {
    const source = await tx.researchSource.create({
      data: { schoolId, field: data.field, url: data.url, sourceType: data.sourceType, retrievedAt, notes: data.notes, createdById: actor.userId },
    })
    await tx.school.update({ where: { id: schoolId }, data: { lastCheckedAt: retrievedAt } })
    return source
  })
}

export async function deleteResearchSource(actor: Actor, sourceId: string) {
  assertPlatformAdmin(actor)
  await prisma.researchSource.delete({ where: { id: sourceId } })
}

export async function addContactAttempt(actor: Actor, schoolId: string, input: ContactAttemptInput) {
  assertPlatformAdmin(actor)
  const data = contactAttemptSchema.parse(input)
  return prisma.$transaction(async (tx) => {
    const school = await tx.school.findUnique({ where: { id: schoolId } })
    if (!school) throw new AppError('NOT_FOUND')
    const attempt = await tx.contactAttempt.create({
      data: {
        schoolId,
        userId: actor.userId,
        channel: data.channel,
        outcome: data.outcome,
        contactedAt: data.contactedAt ? new Date(data.contactedAt) : new Date(),
        notes: data.notes,
        nextStep: data.nextStep,
        nextStepDate: data.nextStepDate ? new Date(data.nextStepDate) : null,
      },
    })
    let stage = school.onboardingStage
    if (data.outcome === 'NOT_INTERESTED') stage = 'DECLINED'
    else if (stage === 'NOT_CONTACTED' || stage === 'DECLINED') stage = 'CONTACTED'
    if (stage !== school.onboardingStage) {
      await tx.school.update({ where: { id: schoolId }, data: { onboardingStage: stage } })
    }
    return attempt
  })
}

export async function addStaffContact(actor: Actor, schoolId: string, input: StaffContactInput) {
  assertPlatformAdmin(actor)
  const data = staffContactSchema.parse(input)
  return prisma.staffContact.create({ data: { schoolId, ...data } })
}

export async function deleteStaffContact(actor: Actor, contactId: string) {
  assertPlatformAdmin(actor)
  await prisma.staffContact.delete({ where: { id: contactId } })
}

export async function addBranchAsAdmin(actor: Actor, schoolId: string, input: BranchInput) {
  assertPlatformAdmin(actor)
  const data = branchSchema.parse(input)
  const location = data.isOnline ? { cityId: null, lat: null, lng: null } : await locateBranch(data)
  return prisma.branch.create({
    data: {
      schoolId,
      name: data.name,
      isOnline: data.isOnline,
      address: data.address,
      postcode: normalizePostcode(data.postcode),
      cityName: data.cityName,
      phone: data.phone,
      ...location,
    },
  })
}

// ---------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------

async function comparable(db: Db, where: Prisma.SchoolWhereInput) {
  const schools = await db.school.findMany({
    where,
    select: {
      id: true,
      nameNormalized: true,
      websiteDomain: true,
      phoneNormalized: true,
      publicEmail: true,
      cityId: true,
      branches: { select: { postcode: true } },
    },
  })
  return schools.map((s) => ({
    id: s.id,
    nameNormalized: s.nameNormalized,
    websiteDomain: s.websiteDomain,
    phoneNormalized: s.phoneNormalized,
    publicEmail: s.publicEmail,
    cityId: s.cityId,
    postcodes: s.branches.map((b) => b.postcode).filter((p): p is string => !!p),
  }))
}

function candidateFilter(target: DuplicateComparable, excludeId: string): Prisma.SchoolWhereInput {
  const firstToken = target.nameNormalized.split(' ').find((t) => t.length > 3)
  const or: Prisma.SchoolWhereInput[] = [{ nameNormalized: target.nameNormalized }]
  if (target.websiteDomain) or.push({ websiteDomain: target.websiteDomain })
  if (target.phoneNormalized) or.push({ phoneNormalized: target.phoneNormalized })
  if (target.publicEmail) or.push({ publicEmail: target.publicEmail })
  if (firstToken) or.push({ nameNormalized: { contains: firstToken } })
  if (target.postcodes.length) or.push({ branches: { some: { postcode: { in: target.postcodes } } } })
  return { id: { not: excludeId }, mergedIntoId: null, OR: or }
}

/** Finds likely duplicates of one school and records them for review. Returns how many were flagged. */
export async function flagDuplicates(db: Db, schoolId: string, importBatchId?: string) {
  const [target] = await comparable(db, { id: schoolId })
  if (!target) return 0
  const others = await comparable(db, candidateFilter(target, schoolId))
  let flagged = 0
  for (const other of others) {
    const { score, reasons } = scoreDuplicate(target, other)
    if (score < DUPLICATE_THRESHOLD) continue
    const existing = await db.duplicateCandidate.findFirst({
      where: {
        OR: [
          { schoolId, otherSchoolId: other.id },
          { schoolId: other.id, otherSchoolId: schoolId },
        ],
      },
    })
    if (existing) continue
    await db.duplicateCandidate.create({ data: { schoolId, otherSchoolId: other.id, score, reasons, importBatchId } })
    flagged++
  }
  return flagged
}

export async function dismissDuplicate(actor: Actor, candidateId: string) {
  assertPlatformAdmin(actor)
  return prisma.duplicateCandidate.update({
    where: { id: candidateId },
    data: { status: 'DISMISSED', resolvedById: actor.userId, resolvedAt: new Date() },
  })
}

export const MERGEABLE_FIELDS = ['name', 'legalName', 'website', 'publicEmail', 'phone', 'schoolType', 'cityId', 'description'] as const
export type MergeableField = (typeof MERGEABLE_FIELDS)[number]

/**
 * Merges `removeId` into `keepId`. Field values are taken from whichever record
 * `choices` names; sources, contact history, staff contacts and branches from
 * both records are kept. The removed record becomes INACTIVE and points at the kept one.
 */
export async function mergeSchools(
  actor: Actor,
  keepId: string,
  removeId: string,
  choices: Partial<Record<MergeableField, 'keep' | 'remove'>>
) {
  assertPlatformAdmin(actor)
  if (keepId === removeId) throw new AppError('VALIDATION')

  return prisma.$transaction(async (tx) => {
    const [keep, remove] = await Promise.all([
      tx.school.findUnique({ where: { id: keepId } }),
      tx.school.findUnique({
        where: { id: removeId },
        include: { _count: { select: { memberships: true, courseTypes: true, bookings: true } } },
      }),
    ])
    if (!keep || !remove) throw new AppError('NOT_FOUND')
    if (remove.status === 'PARTNER' || remove._count.memberships || remove._count.courseTypes || remove._count.bookings) {
      throw new AppError('CONFLICT', 'The record being removed has a partner account or courses; keep that one instead')
    }

    const fields: Record<string, unknown> = {}
    for (const field of MERGEABLE_FIELDS) {
      if (choices[field] === 'remove') fields[field] = remove[field]
    }
    const merged = { ...keep, ...fields } as School
    const update = {
      ...fields,
      ...derivedFields({ name: merged.name, website: merged.website, phone: merged.phone }),
      languagesOffered: Array.from(new Set([...keep.languagesOffered, ...remove.languagesOffered])),
      courseTypesOffered: Array.from(new Set([...keep.courseTypesOffered, ...remove.courseTypesOffered])),
      lastCheckedAt:
        [keep.lastCheckedAt, remove.lastCheckedAt]
          .filter((d): d is Date => !!d)
          .sort((a, b) => a.getTime() - b.getTime())
          .pop() ?? null,
    }
    await tx.school.update({ where: { id: keepId }, data: update as Prisma.SchoolUpdateInput })

    await tx.researchSource.updateMany({ where: { schoolId: removeId }, data: { schoolId: keepId } })
    await tx.contactAttempt.updateMany({ where: { schoolId: removeId }, data: { schoolId: keepId } })
    await tx.staffContact.updateMany({ where: { schoolId: removeId }, data: { schoolId: keepId } })
    await tx.branch.updateMany({ where: { schoolId: removeId }, data: { schoolId: keepId } })
    await tx.schoolInvitation.updateMany({ where: { schoolId: removeId, acceptedAt: null }, data: { revokedAt: new Date() } })

    await tx.school.update({
      where: { id: removeId },
      data: { status: 'INACTIVE', instantBookingEnabled: false, mergedIntoId: keepId, inactiveReason: `Merged into ${keep.name}` },
    })

    await tx.duplicateCandidate.updateMany({
      where: {
        status: 'OPEN',
        OR: [
          { schoolId: removeId, otherSchoolId: keepId },
          { schoolId: keepId, otherSchoolId: removeId },
        ],
      },
      data: { status: 'MERGED', resolvedById: actor.userId, resolvedAt: new Date() },
    })
    // Other open pairs that involved the removed record now refer to a merged record.
    await tx.duplicateCandidate.updateMany({
      where: { status: 'OPEN', OR: [{ schoolId: removeId }, { otherSchoolId: removeId }] },
      data: { status: 'DISMISSED', resolvedById: actor.userId, resolvedAt: new Date() },
    })

    await audit(tx, {
      actorId: actor.userId,
      schoolId: keepId,
      entity: 'School',
      entityId: keepId,
      action: 'school.merged',
      before: { keep: { id: keep.id, name: keep.name }, removed: { id: remove.id, name: remove.name } },
      after: { fieldsFromRemoved: Object.keys(fields) },
    })
    return keepId
  })
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['name', 'school', 'schule', 'schulname', 'school_name'],
  website: ['website', 'url', 'webseite', 'homepage'],
  email: ['email', 'e-mail', 'mail', 'public_email'],
  phone: ['phone', 'telefon', 'tel', 'telephone'],
  address: ['address', 'adresse', 'strasse', 'straße', 'street'],
  postcode: ['postcode', 'plz', 'zip', 'postleitzahl'],
  city: ['city', 'stadt', 'ort'],
  type: ['type', 'school_type', 'schultyp', 'art'],
  languages: ['languages', 'sprachen'],
  courseTypes: ['course_types', 'kursarten', 'coursetypes'],
  sourceUrl: ['source_url', 'source', 'quelle'],
  sourceType: ['source_type', 'quellentyp'],
  checkedAt: ['checked_at', 'last_checked', 'geprueft_am', 'geprüft_am'],
  notes: ['notes', 'notizen', 'bemerkung'],
}

function pick(row: Record<string, string>, field: keyof typeof COLUMN_ALIASES) {
  for (const alias of COLUMN_ALIASES[field]) {
    if (row[alias]) return row[alias]
  }
  return ''
}

function parseSchoolType(value: string): (typeof SCHOOL_TYPES)[number] {
  const v = value.trim().toUpperCase()
  if ((SCHOOL_TYPES as readonly string[]).includes(v)) return v as (typeof SCHOOL_TYPES)[number]
  if (/VHS|VOLKSHOCHSCHULE/.test(v)) return 'VHS'
  if (/UNI|HOCHSCHULE/.test(v)) return 'UNIVERSITY'
  if (/E\.?V|VEREIN|NON.?PROFIT/.test(v)) return 'NON_PROFIT'
  return v ? 'OTHER' : 'PRIVATE'
}

function parseList(value: string) {
  return value
    .split(/[|,/]/)
    .map((v) => v.trim())
    .filter(Boolean)
}

export type ImportRowResult = {
  row: number
  name: string
  outcome: 'created' | 'exists' | 'skipped'
  schoolId?: string
  duplicates?: number
  error?: string
}

export type ImportResult = {
  batchId: string
  created: number
  existing: number
  skipped: number
  duplicatesFlagged: number
  rows: ImportRowResult[]
}

/**
 * Imports candidate schools from CSV. Rows that exactly match an existing
 * record (same name and same website or phone) are not re-created; their source
 * link is added to the existing record. Everything else becomes a DISCOVERED
 * school, and likely duplicates are flagged for review.
 */
export async function importSchoolsCsv(actor: Actor, csv: string, options: { cityId?: string; fileName?: string }): Promise<ImportResult> {
  assertPlatformAdmin(actor)
  const records = parseCsvRecords(csv)
  if (records.length === 0) throw new AppError('VALIDATION', 'The file has no data rows')
  if (records.length > 2000) throw new AppError('VALIDATION', 'Import at most 2000 rows at a time')

  const batchCity = options.cityId ? await prisma.city.findUnique({ where: { id: options.cityId } }) : null
  const batch = await prisma.importBatch.create({
    data: { cityId: batchCity?.id, fileName: options.fileName, rowCount: records.length, createdById: actor.userId },
  })

  const rows: ImportRowResult[] = []
  let duplicatesFlagged = 0

  for (const [index, record] of records.entries()) {
    const rowNumber = index + 2 // header is row 1
    const name = pick(record, 'name')
    if (!name) {
      rows.push({ row: rowNumber, name: '', outcome: 'skipped', error: 'missing_name' })
      continue
    }

    const cityName = pick(record, 'city')
    const city = cityName ? await findCityByName(cityName) : batchCity
    if (!city) {
      rows.push({ row: rowNumber, name, outcome: 'skipped', error: 'unknown_city' })
      continue
    }

    const website = normalizeUrl(pick(record, 'website'))
    const phone = pick(record, 'phone') || null
    const derived = derivedFields({ name, website, phone })
    const sourceUrl = pick(record, 'sourceUrl') || website
    const sourceTypeRaw = pick(record, 'sourceType').toUpperCase()
    const sourceType = (SOURCE_TYPES as readonly string[]).includes(sourceTypeRaw)
      ? (sourceTypeRaw as (typeof SOURCE_TYPES)[number])
      : website && sourceUrl === website
        ? 'SCHOOL_WEBSITE'
        : 'IMPORT'
    const checkedAtRaw = pick(record, 'checkedAt')
    const checkedAt = checkedAtRaw && !Number.isNaN(Date.parse(checkedAtRaw)) ? new Date(checkedAtRaw) : new Date()

    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const exact = await tx.school.findFirst({
          where: {
            nameNormalized: derived.nameNormalized,
            mergedIntoId: null,
            OR: [
              ...(derived.websiteDomain ? [{ websiteDomain: derived.websiteDomain }] : []),
              ...(derived.phoneNormalized ? [{ phoneNormalized: derived.phoneNormalized }] : []),
            ],
          },
        })
        if (exact && (derived.websiteDomain || derived.phoneNormalized)) {
          if (sourceUrl) {
            const known = await tx.researchSource.findFirst({ where: { schoolId: exact.id, url: sourceUrl } })
            if (!known) {
              await tx.researchSource.create({
                data: { schoolId: exact.id, url: sourceUrl, sourceType, retrievedAt: checkedAt, notes: pick(record, 'notes') || null, createdById: actor.userId },
              })
            }
          }
          return { outcome: 'exists' as const, schoolId: exact.id, duplicates: 0 }
        }

        const school = await tx.school.create({
          data: {
            slug: await uniqueSchoolSlug(tx, name, city.name),
            name,
            website,
            publicEmail: pick(record, 'email').toLowerCase() || null,
            phone,
            schoolType: parseSchoolType(pick(record, 'type')),
            cityId: city.id,
            languagesOffered: parseList(pick(record, 'languages')).map((l) => l.toLowerCase().slice(0, 5)),
            courseTypesOffered: parseList(pick(record, 'courseTypes'))
              .map((c) => c.toUpperCase().replace(/[\s-]+/g, '_'))
              .filter((c): c is (typeof COURSE_CATEGORIES)[number] => (COURSE_CATEGORIES as readonly string[]).includes(c)),
            lastCheckedAt: checkedAt,
            ...derived,
          },
        })
        if (sourceUrl || pick(record, 'notes')) {
          await tx.researchSource.create({
            data: { schoolId: school.id, url: sourceUrl, sourceType, retrievedAt: checkedAt, notes: pick(record, 'notes') || null, createdById: actor.userId },
          })
        }
        const address = pick(record, 'address')
        const postcode = normalizePostcode(pick(record, 'postcode'))
        if (address || postcode) {
          await tx.branch.create({
            data: {
              schoolId: school.id,
              name: city.name,
              address: address || null,
              postcode,
              cityName: city.name,
              cityId: city.id,
              lat: city.lat,
              lng: city.lng,
            },
          })
        }
        const duplicates = await flagDuplicates(tx, school.id, batch.id)
        return { outcome: 'created' as const, schoolId: school.id, duplicates }
      })
      duplicatesFlagged += outcome.duplicates
      rows.push({ row: rowNumber, name, ...outcome })
    } catch (error) {
      console.error('[import] row failed', rowNumber, error)
      rows.push({ row: rowNumber, name, outcome: 'skipped', error: 'invalid_row' })
    }
  }

  const created = rows.filter((r) => r.outcome === 'created').length
  const existing = rows.filter((r) => r.outcome === 'exists').length
  const skipped = rows.filter((r) => r.outcome === 'skipped').length
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      createdCount: created,
      duplicateCount: duplicatesFlagged,
      skippedCount: skipped,
      errors: rows.filter((r) => r.error).map((r) => ({ row: r.row, name: r.name, error: r.error })),
    },
  })
  if (batchCity && batchCity.researchStatus === 'NOT_STARTED') {
    await prisma.city.update({ where: { id: batchCity.id }, data: { researchStatus: 'IN_PROGRESS' } })
  }

  return { batchId: batch.id, created, existing, skipped, duplicatesFlagged, rows }
}
