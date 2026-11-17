import type { Prisma } from '@prisma/client'

export type StudentFilters = {
  search?: string
  courseId?: string
  level?: string
  status?: string
}

export function buildStudentWhere(filters: StudentFilters): Prisma.StudentWhereInput {
  const where: Prisma.StudentWhereInput = {}
  const clauses: Prisma.StudentWhereInput[] = []

  if (filters.search) {
    clauses.push({
      OR: [
        { id: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { user: { name: { contains: filters.search, mode: 'insensitive' } } },
        { user: { email: { contains: filters.search, mode: 'insensitive' } } },
      ],
    })
  }

  if (filters.level) {
    clauses.push({ germanLevel: filters.level as Prisma.StudentWhereInput['germanLevel'] })
  }

  if (filters.status) {
    clauses.push({ status: filters.status as Prisma.StudentWhereInput['status'] })
  }

  if (filters.courseId) {
    clauses.push({ enrollments: { some: { courseId: filters.courseId } } })
  }

  if (clauses.length > 0) {
    where.AND = clauses
  }

  return where
}

export type RegistrationFilters = {
  search?: string
  status?: string
  level?: string
  course?: string
}

export function buildRegistrationWhere(filters: RegistrationFilters): Prisma.RegistrationWhereInput {
  const clauses: Prisma.RegistrationWhereInput[] = []

  if (filters.search) {
    clauses.push({
      OR: [
        { id: { contains: filters.search, mode: 'insensitive' } },
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ],
    })
  }

  if (filters.status) {
    clauses.push({ status: filters.status as Prisma.RegistrationWhereInput['status'] })
  }

  if (filters.level) {
    clauses.push({ germanLevel: filters.level as Prisma.RegistrationWhereInput['germanLevel'] })
  }

  if (filters.course) {
    clauses.push({ preferredCourse: filters.course })
  }

  return clauses.length > 0 ? { AND: clauses } : {}
}
