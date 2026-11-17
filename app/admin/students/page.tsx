import { requireAdmin } from '@/app/actions/auth'
import { buildStudentWhere } from '@/lib/admin-filters'
import { prisma } from '@/lib/prisma'
import { Pagination } from '@/components/ui/pagination'
import { Search } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Students | Admin Dashboard',
}

const PAGE_SIZE = 20

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
  COMPLETED: 'bg-blue-100 text-blue-800',
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    course?: string
    level?: string
    status?: string
    page?: string
  }>
}) {
  await requireAdmin()
  const params = await searchParams

  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const filters = {
    search: params.search?.trim() || undefined,
    courseId: params.course || undefined,
    level: params.level || undefined,
    status: params.status || undefined,
  }
  const where = buildStudentWhere(filters)

  const [students, totalCount, courses] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        user: true,
        enrollments: { include: { course: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.student.count({ where }),
    prisma.course.findMany({ orderBy: { name: 'asc' } }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const buildHref = (targetPage: number) => {
    const qs = new URLSearchParams()
    if (filters.search) qs.set('search', filters.search)
    if (filters.courseId) qs.set('course', filters.courseId)
    if (filters.level) qs.set('level', filters.level)
    if (filters.status) qs.set('status', filters.status)
    qs.set('page', String(targetPage))
    return `/admin/students?${qs.toString()}`
  }

  const exportHref = (() => {
    const qs = new URLSearchParams()
    if (filters.search) qs.set('search', filters.search)
    if (filters.courseId) qs.set('course', filters.courseId)
    if (filters.level) qs.set('level', filters.level)
    if (filters.status) qs.set('status', filters.status)
    return `/api/admin/students/export?${qs.toString()}`
  })()

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-dark-gray mb-2">
            Students
          </h2>
          <p className="text-muted-foreground">
            View and manage all registered students
          </p>
        </div>
        <a
          href={exportHref}
          className="bg-white border border-border text-dark-gray px-4 py-2 rounded-lg hover:bg-cream transition-all text-sm font-medium"
        >
          Export to CSV
        </a>
      </div>

      {/* Filters */}
      <form className="bg-white rounded-lg shadow-soft p-6 flex flex-col md:flex-row gap-4" method="get">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            name="search"
            defaultValue={filters.search}
            placeholder="Search by name, email, phone, or ID..."
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <select
          name="course"
          defaultValue={filters.courseId || ''}
          className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        >
          <option value="">All Courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>

        <select
          name="level"
          defaultValue={filters.level || ''}
          className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        >
          <option value="">All Levels</option>
          <option value="A1">A1</option>
          <option value="A2">A2</option>
          <option value="B1">B1</option>
          <option value="B2">B2</option>
          <option value="C1">C1</option>
          <option value="C2">C2</option>
        </select>

        <select
          name="status"
          defaultValue={filters.status || ''}
          className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="COMPLETED">Completed</option>
        </select>

        <button
          type="submit"
          className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-all font-medium"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Phone</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Level</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Courses</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Joined</th>
              </tr>
            </thead>
            <tbody>
              {students.length > 0 ? (
                students.map((student) => (
                  <tr key={student.id} className="border-b border-border hover:bg-cream transition-colors">
                    <td className="px-6 py-4 font-medium text-dark-gray">
                      <Link
                        href={`/admin/students/${student.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {student.user.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {student.user.email}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {student.phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {student.germanLevel || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {student.enrollments.length > 0
                        ? student.enrollments.map((e) => e.course.name).join(', ')
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          STATUS_STYLES[student.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {student.createdAt.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No students found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
          buildHref={buildHref}
        />
      </div>
    </div>
  )
}
