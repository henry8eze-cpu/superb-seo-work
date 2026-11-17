import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { MockEmailService } from '@/lib/email'
import { AppError } from '@/lib/errors'
import {
  addContactAttempt,
  addResearchSource,
  createSchool as createSchoolRecord,
  getCityCoverage,
  importSchoolsCsv,
  markSchoolInactive,
  mergeSchools,
  verifySchool,
} from '@/lib/services/school-research'
import { approveClaim, findInvitation, inviteSchoolToClaim, rejectClaim, submitClaim, inviteStaff, acceptStaffInvitation } from '@/lib/services/onboarding'
import { setInstantBooking } from '@/lib/services/courses'
import { permissionsFor } from '@/lib/permissions'
import { createUser, ensureReferenceData, createSchool } from './fixtures'

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === code)
}

const CSV = `name;website;email;phone;address;plz;city;type;source_url
Sprachschule Rhein;www.sprachschule-rhein.de;info@sprachschule-rhein.de;0201 123456;Kettwiger Str. 5;45127;Essen;private;https://www.sprachschule-rhein.de/impressum
Volkshochschule Essen;https://www.vhs-essen.de;;0201 88 43 200;Hollestr. 75;45127;Essen;VHS;https://www.vhs-essen.de/kontakt
Rhein Sprachschule GmbH;sprachschule-rhein.de;;;;;Essen;;https://example-directory.de/rhein
Mystery School;;;;;;Atlantis;;`

describe('city-by-city research', () => {
  it('imports candidates, flags duplicates, and does not re-create exact matches', async () => {
    const admin = await createUser('PLATFORM_ADMIN')
    const city = await ensureReferenceData()

    const result = await importSchoolsCsv(admin, CSV, { cityId: city.id, fileName: 'essen.csv' })

    expect(result.created).toBe(3)
    expect(result.skipped).toBe(1) // unknown city
    expect(result.rows.find((r) => r.name === 'Mystery School')?.error).toBe('unknown_city')
    expect(result.duplicatesFlagged).toBeGreaterThanOrEqual(1)
    const duplicate = await prisma.duplicateCandidate.findFirstOrThrow({ include: { school: true, otherSchool: true } })
    expect(duplicate.reasons).toContain('domain')
    expect([duplicate.school.name, duplicate.otherSchool.name].sort()).toEqual(['Rhein Sprachschule GmbH', 'Sprachschule Rhein'])

    const schools = await prisma.school.findMany({ include: { sources: true, branches: true } })
    expect(schools.every((s) => s.status === 'DISCOVERED' && s.sources.length === 1)).toBe(true)
    const vhs = schools.find((s) => s.name === 'Volkshochschule Essen')!
    expect(vhs).toMatchObject({ schoolType: 'VHS', websiteDomain: 'vhs-essen.de', phoneNormalized: '49201884320' + '0' })
    expect(vhs.branches[0]).toMatchObject({ postcode: '45127', cityId: city.id })

    // Re-importing the same file creates nothing new.
    const again = await importSchoolsCsv(admin, CSV, { cityId: city.id })
    expect(again.created).toBe(0)
    expect(again.existing).toBe(3)
    expect(await prisma.school.count()).toBe(3)

    const coverage = (await getCityCoverage()).find((c) => c.id === city.id)!
    expect(coverage).toMatchObject({ total: 3, discovered: 3, verified: 0, partner: 0 })
    expect((await prisma.city.findUniqueOrThrow({ where: { id: city.id } })).researchStatus).toBe('IN_PROGRESS')
  })

  it('requires a source before verifying and records the status change in the audit log', async () => {
    const admin = await createUser('PLATFORM_ADMIN')
    const city = await ensureReferenceData()
    const school = await createSchoolRecord(admin, { name: 'Lingua Essen', schoolType: 'PRIVATE', cityId: city.id })

    await expectCode(verifySchool(admin, school.id, {}), 'VALIDATION')
    await addResearchSource(admin, school.id, { url: 'https://lingua-essen.de/impressum', sourceType: 'SCHOOL_WEBSITE' })
    const verified = await verifySchool(admin, school.id, { legalName: 'Lingua Essen GmbH' })

    expect(verified).toMatchObject({ status: 'VERIFIED', legalName: 'Lingua Essen GmbH' })
    expect(verified.lastCheckedAt).toBeTruthy()
    const event = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: school.id, action: 'school.verified' } })
    expect(event).toMatchObject({ actorId: admin.userId, before: { status: 'DISCOVERED' }, after: { status: 'VERIFIED' } })
  })

  it('merges duplicates, keeping sources and history from both records', async () => {
    const admin = await createUser('PLATFORM_ADMIN')
    const city = await ensureReferenceData()
    const keep = await createSchoolRecord(admin, { name: 'Sprachschule Rhein', schoolType: 'PRIVATE', cityId: city.id, website: 'sprachschule-rhein.de' }, { url: 'https://a.example', sourceType: 'SCHOOL_WEBSITE' })
    const remove = await createSchoolRecord(admin, { name: 'Rhein Sprachschule', schoolType: 'PRIVATE', cityId: city.id, website: 'www.sprachschule-rhein.de', phone: '0201 999' }, { url: 'https://b.example', sourceType: 'OTHER' })
    await addContactAttempt(admin, remove.id, { channel: 'PHONE', outcome: 'CALL_BACK' })
    expect(await prisma.duplicateCandidate.count({ where: { status: 'OPEN' } })).toBe(1)

    await mergeSchools(admin, keep.id, remove.id, { phone: 'remove' })

    const kept = await prisma.school.findUniqueOrThrow({ where: { id: keep.id }, include: { sources: true, contactAttempts: true } })
    expect(kept.sources.map((s) => s.url).sort()).toEqual(['https://a.example', 'https://b.example'])
    expect(kept.contactAttempts).toHaveLength(1)
    expect(kept.phone).toBe('0201 999')
    expect(await prisma.school.findUniqueOrThrow({ where: { id: remove.id } })).toMatchObject({ status: 'INACTIVE', mergedIntoId: keep.id })
    expect(await prisma.duplicateCandidate.count({ where: { status: 'OPEN' } })).toBe(0)
  })
})

describe('profile claims', () => {
  async function verifiedSchool() {
    const admin = await createUser('PLATFORM_ADMIN')
    const city = await ensureReferenceData()
    const school = await createSchoolRecord(
      admin,
      { name: 'Deutschwerk Essen', schoolType: 'PRIVATE', cityId: city.id, website: 'https://deutschwerk.de', publicEmail: 'info@deutschwerk.de' },
      { url: 'https://deutschwerk.de/impressum', sourceType: 'SCHOOL_WEBSITE' }
    )
    await verifySchool(admin, school.id, {})
    return { admin, school }
  }

  function tokenFromOutbox() {
    const email = MockEmailService.outbox.find((m) => m.html.includes('/claim/'))!
    return email.html.match(/\/claim\/([A-Za-z0-9_-]+)/)![1]
  }

  it('invites, lets the school claim, and on approval makes it a partner with an owner', async () => {
    const { admin, school } = await verifiedSchool()
    await inviteSchoolToClaim(admin, school.id, 'info@deutschwerk.de')
    expect((await prisma.school.findUniqueOrThrow({ where: { id: school.id } })).onboardingStage).toBe('INVITED')

    const token = tokenFromOutbox()
    expect(await findInvitation(token, 'CLAIM')).toBeTruthy()
    expect(await findInvitation('not-a-token', 'CLAIM')).toBeNull()

    const rep = await createUser('STUDENT', 'Maria Muster')
    const repActor = { ...rep, email: 'maria@deutschwerk.de' }
    await prisma.user.update({ where: { id: rep.userId }, data: { email: repActor.email } })
    const claim = await submitClaim(repActor, token, { claimantName: 'Maria Muster', claimantPosition: 'Geschäftsführerin', confirmAuthority: true }, [
      { fileName: 'handelsregister.pdf', mimeType: 'application/pdf', data: Buffer.from('%PDF-1.4 test') },
    ])
    expect(claim.emailDomainMatches).toBe(true)
    expect((await prisma.school.findUniqueOrThrow({ where: { id: school.id } })).onboardingStage).toBe('CLAIM_PENDING')

    // Still not a partner: a pending claim grants nothing.
    const pendingActor = { ...repActor, schoolId: school.id, schoolRole: 'OWNER' as const, permissions: permissionsFor('PLATFORM_ADMIN') }
    await expectCode(setInstantBooking(pendingActor, true, true), 'NOT_PARTNER')

    await approveClaim(admin, claim.id, 'Checked Handelsregister')

    const after = await prisma.school.findUniqueOrThrow({ where: { id: school.id }, include: { memberships: true } })
    expect(after).toMatchObject({ status: 'PARTNER', onboardingStage: 'ONBOARDED', instantBookingEnabled: false })
    expect(after.memberships[0]).toMatchObject({ userId: rep.userId, role: 'OWNER' })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: rep.userId } })).role).toBe('SCHOOL_USER')
    expect(await findInvitation(token, 'CLAIM')).toBeNull() // used up
    expect(await prisma.auditEvent.count({ where: { entityId: school.id, action: 'school.partner_approved' } })).toBe(1)

    // Now the owner may switch instant booking on, but only after agreeing to keep capacity current.
    await expectCode(setInstantBooking(pendingActor, true, false), 'VALIDATION')
    await setInstantBooking(pendingActor, true, true)
    expect((await prisma.school.findUniqueOrThrow({ where: { id: school.id } })).instantBookingEnabled).toBe(true)
  })

  it('a rejected claim leaves the school unclaimed', async () => {
    const { admin, school } = await verifiedSchool()
    await inviteSchoolToClaim(admin, school.id, 'info@deutschwerk.de')
    const rep = await createUser('STUDENT')
    const claim = await submitClaim(rep, tokenFromOutbox(), { claimantName: 'Some One', claimantPosition: 'Teacher', confirmAuthority: true })
    expect(claim.emailDomainMatches).toBe(false)

    await rejectClaim(admin, claim.id, 'Not listed in the Handelsregister')

    expect(await prisma.school.findUniqueOrThrow({ where: { id: school.id } })).toMatchObject({ status: 'VERIFIED', onboardingStage: 'INVITED' })
    expect(await prisma.schoolMembership.count()).toBe(0)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: rep.userId } })).role).toBe('STUDENT')
  })

  it('only verified schools can be invited, and deactivating a partner switches instant booking off', async () => {
    const admin = await createUser('PLATFORM_ADMIN')
    const city = await ensureReferenceData()
    const discovered = await createSchoolRecord(admin, { name: 'Unchecked School', schoolType: 'PRIVATE', cityId: city.id })
    await expectCode(inviteSchoolToClaim(admin, discovered.id, 'a@b.de'), 'CONFLICT')

    const { school } = await createSchool({ status: 'PARTNER', instantBooking: true })
    await markSchoolInactive(admin, school.id, 'Closed down')
    expect(await prisma.school.findUniqueOrThrow({ where: { id: school.id } })).toMatchObject({ status: 'INACTIVE', instantBookingEnabled: false })
  })

  it('non-admins cannot use research tools', async () => {
    const student = await createUser('STUDENT')
    const city = await ensureReferenceData()
    await expectCode(createSchoolRecord(student, { name: 'Sneaky', schoolType: 'PRIVATE', cityId: city.id }), 'FORBIDDEN')
    await expectCode(importSchoolsCsv(student, CSV, { cityId: city.id }), 'FORBIDDEN')
  })
})

describe('staff invitations', () => {
  it('only the invited email address can join, with the granted permissions', async () => {
    const { school, owner } = await createSchool()
    await inviteStaff(owner, { email: 'colleague@example.test', canManageBookings: true })
    const token = MockEmailService.outbox.find((m) => m.html.includes('/invite/'))!.html.match(/\/invite\/([A-Za-z0-9_-]+)/)![1]

    const stranger = await createUser('STUDENT')
    await expectCode(acceptStaffInvitation(stranger, token), 'FORBIDDEN')

    const colleague = await createUser('STUDENT')
    await prisma.user.update({ where: { id: colleague.userId }, data: { email: 'colleague@example.test' } })
    await acceptStaffInvitation({ ...colleague, email: 'colleague@example.test' }, token)

    const membership = await prisma.schoolMembership.findFirstOrThrow({ where: { userId: colleague.userId } })
    expect(membership).toMatchObject({ schoolId: school.id, role: 'STAFF', canManageBookings: true, canManageCourses: false })
  })
})

describe('school locations', () => {
  it('accepts an address anywhere in Germany and refuses invalid postcodes', async () => {
    const { owner } = await createSchool()
    const { createBranch } = await import('@/lib/services/courses')
    const berlin = await createBranch(owner, { name: 'Berlin Mitte', address: 'Friedrichstraße 100', postcode: '10117', cityName: 'Berlin' })
    expect(berlin).toMatchObject({ postcode: '10117', cityName: 'Berlin', isOnline: false })
    await expectCode(createBranch(owner, { name: 'Typo', address: 'Hauptstr. 1', postcode: '1011', cityName: 'Berlin' }), 'VALIDATION')
    await expectCode(createBranch(owner, { name: 'No city', address: 'Hauptstr. 1', postcode: '10117' }), 'VALIDATION')
  })
})
