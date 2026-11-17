import type { MembershipRole, UserRole } from '@prisma/client'
import { AppError } from './errors'

export type Actor = {
  userId: string
  role: UserRole
  name: string
  email: string
}

export const SCHOOL_PERMISSIONS = ['manageCourses', 'manageBookings', 'viewFinances', 'manageStaff'] as const
export type SchoolPermission = (typeof SCHOOL_PERMISSIONS)[number]

export type SchoolActor = Actor & {
  schoolId: string
  /** PLATFORM_ADMIN when a platform admin is working inside a school workspace for support. */
  schoolRole: MembershipRole | 'PLATFORM_ADMIN'
  permissions: Record<SchoolPermission, boolean>
}

export type MembershipFlags = {
  role: MembershipRole
  canManageCourses: boolean
  canManageBookings: boolean
  canViewFinances: boolean
  canManageStaff: boolean
}

export function permissionsFor(membership: MembershipFlags | 'PLATFORM_ADMIN'): Record<SchoolPermission, boolean> {
  if (membership === 'PLATFORM_ADMIN' || membership.role === 'OWNER') {
    return { manageCourses: true, manageBookings: true, viewFinances: true, manageStaff: true }
  }
  return {
    manageCourses: membership.canManageCourses,
    manageBookings: membership.canManageBookings,
    viewFinances: membership.canViewFinances,
    manageStaff: membership.canManageStaff,
  }
}

export function isPlatformAdmin(actor: Pick<Actor, 'role'> | null | undefined) {
  return actor?.role === 'PLATFORM_ADMIN'
}

export function assertPlatformAdmin(actor: Actor) {
  if (!isPlatformAdmin(actor)) throw new AppError('FORBIDDEN')
}

export function assertPermission(actor: SchoolActor, permission: SchoolPermission) {
  if (!actor.permissions[permission]) throw new AppError('FORBIDDEN', `Missing permission: ${permission}`)
}

/**
 * Every school-scoped read and write goes through this. A record that belongs
 * to another school is reported as not found, so its existence is not leaked.
 */
export function assertSameSchool<T extends { schoolId: string }>(
  actor: SchoolActor,
  record: T | null | undefined
): asserts record is T {
  if (!record || record.schoolId !== actor.schoolId) throw new AppError('NOT_FOUND')
}
