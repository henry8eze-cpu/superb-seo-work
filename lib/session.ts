import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from './auth'
import { prisma } from './prisma'
import { permissionsFor, type Actor, type SchoolActor } from './permissions'

export const ACTIVE_SCHOOL_COOKIE = 'activeSchool'

/**
 * The signed-in user, loaded from the database on each request so role and
 * membership changes (e.g. an approved claim) apply without signing in again.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await auth()
  if (!session?.user?.id) return null
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, name: true, email: true },
  })
  if (!user) return null
  return { userId: user.id, role: user.role, name: user.name, email: user.email }
})

export async function requireActor(callbackUrl?: string): Promise<Actor> {
  const actor = await getActor()
  if (!actor) {
    redirect(callbackUrl ? `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/auth/login')
  }
  return actor
}

export async function requirePlatformAdminActor(): Promise<Actor> {
  const actor = await requireActor()
  if (actor.role !== 'PLATFORM_ADMIN') redirect('/auth/login')
  return actor
}

export type SchoolOption = { id: string; name: string }

/** Schools the actor can open in the school app through a membership. */
export async function getSchoolOptions(actor: Actor): Promise<SchoolOption[]> {
  const memberships = await prisma.schoolMembership.findMany({
    where: { userId: actor.userId, status: 'ACTIVE', school: { status: { not: 'INACTIVE' } } },
    include: { school: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return memberships.map((m) => m.school)
}

/**
 * Resolves which school the actor is working in. Members get the selected (or
 * first) active membership; platform admins may open any school for support.
 */
export const getSchoolActor = cache(async (): Promise<SchoolActor | null> => {
  const actor = await getActor()
  if (!actor) return null

  const selected = (await cookies()).get(ACTIVE_SCHOOL_COOKIE)?.value

  const memberships = await prisma.schoolMembership.findMany({
    where: { userId: actor.userId, status: 'ACTIVE', school: { status: { not: 'INACTIVE' } } },
    orderBy: { createdAt: 'asc' },
  })

  const selectedMembership = memberships.find((m) => m.schoolId === selected)
  if (selectedMembership) {
    return {
      ...actor,
      schoolId: selectedMembership.schoolId,
      schoolRole: selectedMembership.role,
      permissions: permissionsFor(selectedMembership),
    }
  }

  if (actor.role === 'PLATFORM_ADMIN' && selected) {
    const school = await prisma.school.findUnique({ where: { id: selected }, select: { id: true } })
    if (school) {
      return { ...actor, schoolId: school.id, schoolRole: 'PLATFORM_ADMIN', permissions: permissionsFor('PLATFORM_ADMIN') }
    }
  }

  const first = memberships[0]
  if (first) {
    return { ...actor, schoolId: first.schoolId, schoolRole: first.role, permissions: permissionsFor(first) }
  }

  return null
})

export async function requireSchoolActor(): Promise<SchoolActor> {
  const actor = await requireActor('/school')
  const schoolActor = await getSchoolActor()
  if (!schoolActor) redirect(actor.role === 'PLATFORM_ADMIN' ? '/admin/schools' : '/account')
  return schoolActor
}

/** Where to send someone right after they sign in. */
export async function homePathFor(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, _count: { select: { memberships: { where: { status: 'ACTIVE' } } } } },
  })
  if (!user) return '/'
  if (user.role === 'PLATFORM_ADMIN') return '/admin'
  if (user._count.memberships > 0) return '/school'
  return '/account'
}
