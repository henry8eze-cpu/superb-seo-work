// Inviting schools, profile claims and staff invitations.

import type { MembershipRole } from '@prisma/client'
import { prisma } from '../prisma'
import { audit } from '../audit'
import { AppError } from '../errors'
import { absoluteUrl, CLAIM_DOCUMENT_MAX_BYTES, INVITATION_TTL_DAYS } from '../config'
import { assertPermission, assertPlatformAdmin, type Actor, type SchoolActor } from '../permissions'
import { generateToken, hashToken } from '../tokens'
import { emailDomain } from '../schools/normalize'
import { claimSchema, type ClaimInput } from '../validation/schools'
import { z } from 'zod'
import * as notify from '../notify'

const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg']

function expiry() {
  return new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000)
}

// ---------------------------------------------------------------------------
// Claim invitations (internal admin → school)
// ---------------------------------------------------------------------------

export async function inviteSchoolToClaim(actor: Actor, schoolId: string, email: string) {
  assertPlatformAdmin(actor)
  const address = z.string().trim().toLowerCase().email().parse(email)

  const { invitation, token, school } = await prisma.$transaction(async (tx) => {
    const school = await tx.school.findUnique({ where: { id: schoolId } })
    if (!school) throw new AppError('NOT_FOUND')
    if (school.status !== 'VERIFIED') {
      throw new AppError('CONFLICT', 'Only verified schools that are not yet partners can be invited to claim their profile')
    }
    // One live claim invitation per school.
    await tx.schoolInvitation.updateMany({
      where: { schoolId, kind: 'CLAIM', acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    const { token, hash } = generateToken()
    const invitation = await tx.schoolInvitation.create({
      data: { schoolId, kind: 'CLAIM', email: address, tokenHash: hash, role: 'OWNER', invitedById: actor.userId, expiresAt: expiry() },
    })
    if (school.onboardingStage !== 'CLAIM_PENDING' && school.onboardingStage !== 'ONBOARDED') {
      await tx.school.update({ where: { id: schoolId }, data: { onboardingStage: 'INVITED' } })
    }
    await tx.contactAttempt.create({
      data: { schoolId, userId: actor.userId, channel: 'EMAIL', outcome: 'INVITED', notes: `Claim invitation sent to ${address}` },
    })
    await audit(tx, { actorId: actor.userId, schoolId, entity: 'School', entityId: schoolId, action: 'school.claim_invited', after: { email: address } })
    return { invitation, token, school }
  })

  await notify.sendClaimInvitation({ to: address, schoolName: school.name, link: absoluteUrl(`/claim/${token}`) })
  return invitation
}

export async function revokeInvitation(actor: Actor, invitationId: string) {
  const invitation = await prisma.schoolInvitation.findUnique({ where: { id: invitationId } })
  if (!invitation) throw new AppError('NOT_FOUND')
  if (actor.role !== 'PLATFORM_ADMIN') {
    const membership = await prisma.schoolMembership.findFirst({
      where: { userId: actor.userId, schoolId: invitation.schoolId, status: 'ACTIVE', OR: [{ role: 'OWNER' }, { canManageStaff: true }] },
    })
    if (!membership || invitation.kind !== 'STAFF') throw new AppError('FORBIDDEN')
  }
  return prisma.schoolInvitation.update({ where: { id: invitationId }, data: { revokedAt: new Date() } })
}

/** Looks up a live invitation by its raw token. */
export async function findInvitation(token: string, kind: 'CLAIM' | 'STAFF') {
  const invitation = await prisma.schoolInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { school: { select: { id: true, name: true, status: true, websiteDomain: true, publicEmail: true, city: { select: { name: true } } } } },
  })
  if (
    !invitation ||
    invitation.kind !== kind ||
    invitation.revokedAt ||
    invitation.acceptedAt ||
    invitation.expiresAt < new Date() ||
    invitation.school.status === 'INACTIVE'
  ) {
    return null
  }
  return invitation
}

// ---------------------------------------------------------------------------
// Profile claims (school representative)
// ---------------------------------------------------------------------------

export type ClaimDocumentUpload = { fileName: string; mimeType: string; data: Buffer }

export async function submitClaim(actor: Actor, token: string, input: ClaimInput, documents: ClaimDocumentUpload[] = []) {
  const data = claimSchema.parse(input)
  const invitation = await findInvitation(token, 'CLAIM')
  if (!invitation) throw new AppError('INVITATION_INVALID')

  for (const doc of documents) {
    if (!ALLOWED_DOCUMENT_TYPES.includes(doc.mimeType)) throw new AppError('VALIDATION', 'Upload a PDF, PNG or JPEG file')
    if (doc.data.byteLength > CLAIM_DOCUMENT_MAX_BYTES) throw new AppError('VALIDATION', 'The file is too large')
  }

  const pending = await prisma.profileClaim.findFirst({
    where: { schoolId: invitation.schoolId, userId: actor.userId, status: 'PENDING' },
  })
  if (pending) throw new AppError('CONFLICT', 'You already have a claim waiting for review')

  const claimantDomain = emailDomain(actor.email)
  const schoolDomains = [invitation.school.websiteDomain, emailDomain(invitation.school.publicEmail)].filter(Boolean)
  const emailDomainMatches = !!claimantDomain && schoolDomains.includes(claimantDomain)

  const claim = await prisma.$transaction(async (tx) => {
    const claim = await tx.profileClaim.create({
      data: {
        schoolId: invitation.schoolId,
        userId: actor.userId,
        invitationId: invitation.id,
        claimantName: data.claimantName,
        claimantPosition: data.claimantPosition,
        claimantPhone: data.claimantPhone,
        claimantEmail: actor.email,
        emailDomainMatches,
        message: data.message,
        documents: {
          create: documents.map((doc) => ({
            fileName: doc.fileName.slice(0, 200),
            mimeType: doc.mimeType,
            sizeBytes: doc.data.byteLength,
            data: new Uint8Array(doc.data),
          })),
        },
      },
    })
    await tx.school.update({ where: { id: invitation.schoolId }, data: { onboardingStage: 'CLAIM_PENDING' } })
    await tx.staffContact.create({
      data: {
        schoolId: invitation.schoolId,
        name: data.claimantName,
        position: data.claimantPosition,
        email: actor.email,
        phone: data.claimantPhone,
        notes: 'Submitted a profile claim',
      },
    })
    await audit(tx, {
      actorId: actor.userId,
      schoolId: invitation.schoolId,
      entity: 'ProfileClaim',
      entityId: claim.id,
      action: 'claim.submitted',
      after: { emailDomainMatches, documents: documents.length },
    })
    return claim
  })

  await notify.notifyAdminsOfClaim({ claimId: claim.id, schoolName: invitation.school.name, claimantName: data.claimantName })
  return claim
}

/**
 * Approving a claim is the moment a school becomes a registered partner: the
 * claimant becomes the school's owner. Instant booking stays off until the
 * school switches it on and keeps its capacity up to date.
 */
export async function approveClaim(actor: Actor, claimId: string, note?: string) {
  assertPlatformAdmin(actor)
  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.profileClaim.findUnique({ where: { id: claimId }, include: { school: true, user: true } })
    if (!claim) throw new AppError('NOT_FOUND')
    if (claim.status !== 'PENDING') throw new AppError('CONFLICT', 'This claim has already been reviewed')
    if (claim.school.status === 'INACTIVE') throw new AppError('CONFLICT', 'The school is inactive')

    const now = new Date()
    await tx.profileClaim.update({
      where: { id: claimId },
      data: { status: 'APPROVED', reviewedById: actor.userId, reviewedAt: now, reviewNote: note?.trim() || null },
    })
    if (claim.user.role === 'STUDENT' || claim.user.role === 'INSTRUCTOR') {
      await tx.user.update({ where: { id: claim.userId }, data: { role: 'SCHOOL_USER' } })
    }
    await tx.schoolMembership.upsert({
      where: { schoolId_userId: { schoolId: claim.schoolId, userId: claim.userId } },
      update: { role: 'OWNER', status: 'ACTIVE' },
      create: { schoolId: claim.schoolId, userId: claim.userId, role: 'OWNER' },
    })
    await tx.school.update({
      where: { id: claim.schoolId },
      data: {
        status: 'PARTNER',
        onboardingStage: 'ONBOARDED',
        partnerSince: claim.school.partnerSince ?? now,
        verifiedAt: claim.school.verifiedAt ?? now,
      },
    })
    if (claim.invitationId) {
      await tx.schoolInvitation.update({ where: { id: claim.invitationId }, data: { acceptedAt: now } })
    }
    await audit(tx, {
      actorId: actor.userId,
      schoolId: claim.schoolId,
      entity: 'School',
      entityId: claim.schoolId,
      action: 'school.partner_approved',
      before: { status: claim.school.status },
      after: { status: 'PARTNER', ownerUserId: claim.userId, claimId },
    })
    return claim
  })

  await notify.sendClaimDecision({
    to: result.user.email,
    locale: result.user.locale,
    name: result.claimantName,
    schoolName: result.school.name,
    approved: true,
    note,
  })
  return result
}

export async function rejectClaim(actor: Actor, claimId: string, note: string) {
  assertPlatformAdmin(actor)
  if (!note?.trim()) throw new AppError('VALIDATION', 'Explain why the claim was rejected')
  const claim = await prisma.$transaction(async (tx) => {
    const claim = await tx.profileClaim.findUnique({ where: { id: claimId }, include: { school: true, user: true } })
    if (!claim) throw new AppError('NOT_FOUND')
    if (claim.status !== 'PENDING') throw new AppError('CONFLICT', 'This claim has already been reviewed')
    await tx.profileClaim.update({
      where: { id: claimId },
      data: { status: 'REJECTED', reviewedById: actor.userId, reviewedAt: new Date(), reviewNote: note.trim() },
    })
    const otherPending = await tx.profileClaim.count({ where: { schoolId: claim.schoolId, status: 'PENDING' } })
    if (!otherPending && claim.school.onboardingStage === 'CLAIM_PENDING') {
      await tx.school.update({ where: { id: claim.schoolId }, data: { onboardingStage: 'INVITED' } })
    }
    await audit(tx, { actorId: actor.userId, schoolId: claim.schoolId, entity: 'ProfileClaim', entityId: claimId, action: 'claim.rejected', after: { note } })
    return claim
  })
  await notify.sendClaimDecision({
    to: claim.user.email,
    locale: claim.user.locale,
    name: claim.claimantName,
    schoolName: claim.school.name,
    approved: false,
    note,
  })
  return claim
}

// ---------------------------------------------------------------------------
// Staff invitations (school owner → colleague)
// ---------------------------------------------------------------------------

export const staffInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  canManageCourses: z.boolean().default(false),
  canManageBookings: z.boolean().default(false),
  canViewFinances: z.boolean().default(false),
  canManageStaff: z.boolean().default(false),
})

export async function inviteStaff(actor: SchoolActor, input: z.input<typeof staffInvitationSchema>) {
  assertPermission(actor, 'manageStaff')
  const data = staffInvitationSchema.parse(input)

  const { token, school } = await prisma.$transaction(async (tx) => {
    const school = await tx.school.findUnique({ where: { id: actor.schoolId } })
    if (!school) throw new AppError('NOT_FOUND')
    const existingMember = await tx.schoolMembership.findFirst({
      where: { schoolId: actor.schoolId, status: 'ACTIVE', user: { email: data.email } },
    })
    if (existingMember) throw new AppError('CONFLICT', 'This person is already a member')
    await tx.schoolInvitation.updateMany({
      where: { schoolId: actor.schoolId, kind: 'STAFF', email: data.email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    const { token, hash } = generateToken()
    const invitation = await tx.schoolInvitation.create({
      data: { schoolId: actor.schoolId, kind: 'STAFF', role: 'STAFF', tokenHash: hash, invitedById: actor.userId, expiresAt: expiry(), ...data },
    })
    await audit(tx, {
      actorId: actor.userId,
      schoolId: actor.schoolId,
      entity: 'SchoolInvitation',
      entityId: invitation.id,
      action: 'staff.invited',
      after: data,
    })
    return { token, school }
  })

  await notify.sendStaffInvitation({ to: data.email, schoolName: school.name, inviterName: actor.name, link: absoluteUrl(`/invite/${token}`) })
}

/** The signed-in user accepts a staff invitation. The invitation must be addressed to their email. */
export async function acceptStaffInvitation(actor: Actor, token: string) {
  const invitation = await findInvitation(token, 'STAFF')
  if (!invitation) throw new AppError('INVITATION_INVALID')
  if (invitation.email.toLowerCase() !== actor.email.toLowerCase()) {
    throw new AppError('FORBIDDEN', 'This invitation was sent to a different email address')
  }
  return prisma.$transaction(async (tx) => {
    const flags = {
      role: invitation.role as MembershipRole,
      canManageCourses: invitation.canManageCourses,
      canManageBookings: invitation.canManageBookings,
      canViewFinances: invitation.canViewFinances,
      canManageStaff: invitation.canManageStaff,
      status: 'ACTIVE' as const,
    }
    await tx.schoolMembership.upsert({
      where: { schoolId_userId: { schoolId: invitation.schoolId, userId: actor.userId } },
      update: flags,
      create: { schoolId: invitation.schoolId, userId: actor.userId, ...flags },
    })
    if (actor.role === 'STUDENT' || actor.role === 'INSTRUCTOR') {
      await tx.user.update({ where: { id: actor.userId }, data: { role: 'SCHOOL_USER' } })
    }
    await tx.schoolInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } })
    await audit(tx, {
      actorId: actor.userId,
      schoolId: invitation.schoolId,
      entity: 'SchoolMembership',
      entityId: actor.userId,
      action: 'staff.joined',
      after: flags,
    })
    return invitation.schoolId
  })
}

export const membershipUpdateSchema = z.object({
  canManageCourses: z.boolean(),
  canManageBookings: z.boolean(),
  canViewFinances: z.boolean(),
  canManageStaff: z.boolean(),
})

export async function updateMembership(actor: SchoolActor, membershipId: string, input: z.input<typeof membershipUpdateSchema>) {
  assertPermission(actor, 'manageStaff')
  const data = membershipUpdateSchema.parse(input)
  return prisma.$transaction(async (tx) => {
    const membership = await tx.schoolMembership.findUnique({ where: { id: membershipId } })
    if (!membership || membership.schoolId !== actor.schoolId) throw new AppError('NOT_FOUND')
    if (membership.role === 'OWNER') throw new AppError('CONFLICT', 'Owner permissions cannot be changed')
    const updated = await tx.schoolMembership.update({ where: { id: membershipId }, data })
    await audit(tx, {
      actorId: actor.userId,
      schoolId: actor.schoolId,
      entity: 'SchoolMembership',
      entityId: membershipId,
      action: 'staff.permissions_changed',
      before: {
        canManageCourses: membership.canManageCourses,
        canManageBookings: membership.canManageBookings,
        canViewFinances: membership.canViewFinances,
        canManageStaff: membership.canManageStaff,
      },
      after: data,
    })
    return updated
  })
}

export async function removeMembership(actor: SchoolActor, membershipId: string) {
  assertPermission(actor, 'manageStaff')
  return prisma.$transaction(async (tx) => {
    const membership = await tx.schoolMembership.findUnique({ where: { id: membershipId } })
    if (!membership || membership.schoolId !== actor.schoolId) throw new AppError('NOT_FOUND')
    if (membership.role === 'OWNER') {
      const owners = await tx.schoolMembership.count({ where: { schoolId: actor.schoolId, role: 'OWNER', status: 'ACTIVE' } })
      if (owners <= 1) throw new AppError('CONFLICT', 'A school needs at least one owner')
    }
    await tx.schoolMembership.update({ where: { id: membershipId }, data: { status: 'REMOVED' } })
    await audit(tx, { actorId: actor.userId, schoolId: actor.schoolId, entity: 'SchoolMembership', entityId: membershipId, action: 'staff.removed' })
  })
}
