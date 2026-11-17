import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/actions/auth'
import { buildStudentWhere } from '@/lib/admin-filters'
import { prisma } from '@/lib/prisma'

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(request: NextRequest) {
  await requireAdmin()

  const searchParams = request.nextUrl.searchParams
  const where = buildStudentWhere({
    search: searchParams.get('search') || undefined,
    courseId: searchParams.get('course') || undefined,
    level: searchParams.get('level') || undefined,
    status: searchParams.get('status') || undefined,
  })

  const students = await prisma.student.findMany({
    where,
    include: {
      user: true,
      enrollments: { include: { course: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })

  const headers = [
    'ID',
    'Name',
    'Email',
    'Phone',
    'Country',
    'Date of Birth',
    'German Level',
    'Learning Mode',
    'Preferred Class Time',
    'Status',
    'Courses',
    'Registered On',
  ]

  const rows = students.map((s) => [
    s.id,
    s.user.name,
    s.user.email,
    s.phone || '',
    s.country || '',
    s.dateOfBirth ? s.dateOfBirth.toISOString().split('T')[0] : '',
    s.germanLevel || '',
    s.learningMode || '',
    s.preferredClassTime || '',
    s.status,
    s.enrollments.map((e) => e.course.name).join('; '),
    s.createdAt.toISOString().split('T')[0],
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => csvEscape(String(cell))).join(','))
    .join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="students-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
