import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Courses | Admin Dashboard',
}

export default async function CoursesPage() {
  await requireAdmin()

  const [courses, registrationCounts] = await Promise.all([
    prisma.course.findMany({
      include: {
        instructor: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.registration.groupBy({
      by: ['preferredCourse'],
      _count: true,
    }),
  ])

  const registeredCountByLevel = new Map(
    registrationCounts.map((r) => [r.preferredCourse, r._count])
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-dark-gray mb-2">
            Courses
          </h2>
          <p className="text-muted-foreground">
            Manage all courses and instructor assignments
          </p>
        </div>
        <Link
          href="/admin/courses/new"
          className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-all flex items-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          New Course
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Course Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Level
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Instructor
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Enrolled
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Registered
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {courses.length > 0 ? (
                courses.map((course) => (
                  <tr
                    key={course.id}
                    className="border-b border-border hover:bg-cream transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-dark-gray">
                      <Link
                        href={`/admin/courses/${course.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {course.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {course.level}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          course.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {course.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {course.instructor?.user.name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full">
                        {course._count.enrollments}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/courses/${course.id}`}
                        className="bg-secondary/20 text-primary text-sm font-semibold px-3 py-1 rounded-full hover:bg-secondary/30 transition-colors"
                      >
                        {registeredCountByLevel.get(course.level) || 0}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {course.duration} hours
                    </td>
                    <td className="px-6 py-4 font-semibold text-dark-gray">
                      €{course.price}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/courses/${course.id}/edit`}
                        className="text-primary text-sm font-medium hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    No courses found. <Link href="/admin/courses/new" className="text-primary hover:underline">Create your first course</Link>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
