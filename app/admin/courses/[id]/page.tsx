import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { deleteCourse } from '@/app/actions/courses'
import { ConfirmDeleteButton } from '@/components/admin/confirm-delete-button'
import { AssignStudentForm } from '@/components/admin/assign-student-form'
import { EnrollmentsTable } from '@/components/admin/enrollments-table'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'

export const metadata = {
  title: 'Course Details | Admin Dashboard',
}

const REGISTRATION_STATUS_STYLES: Record<string, string> = {
  NEW: 'bg-yellow-100 text-yellow-800',
  CONTACTED: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-orange-100 text-orange-800',
  ENROLLED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      instructor: { include: { user: true } },
      enrollments: {
        include: { student: { include: { user: true } } },
        orderBy: { enrollmentDate: 'desc' },
      },
    },
  })

  if (!course) {
    notFound()
  }

  const [registrations, allStudents] = await Promise.all([
    prisma.registration.findMany({
      where: { preferredCourse: course.level },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.student.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const enrolledStudentIds = new Set(course.enrollments.map((e) => e.student.id))
  const eligibleStudents = allStudents.filter((s) => !enrolledStudentIds.has(s.id))

  return (
    <div className="space-y-6">
      <Link
        href="/admin/courses"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Courses
      </Link>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-poppins text-2xl font-bold text-dark-gray">
              {course.name}
            </h2>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                course.status === 'ACTIVE'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {course.status === 'ACTIVE' ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-muted-foreground mt-2">
            {course.language} · {course.level} · {course.duration} hours · €{course.price}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/admin/courses/${course.id}/edit`}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-all text-sm font-medium"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Link>
          <ConfirmDeleteButton
            title="Delete course"
            description={`Are you sure you want to delete "${course.name}"? This cannot be undone. Courses with enrolled students cannot be deleted.`}
            action={deleteCourse.bind(null, course.id)}
          />
        </div>
      </div>

      {/* Course Info */}
      <div className="bg-white rounded-lg shadow-soft p-6 grid md:grid-cols-4 gap-6">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Instructor</p>
          <p className="font-medium text-dark-gray">
            {course.instructor?.user.name || 'Unassigned'}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Max Students</p>
          <p className="font-medium text-dark-gray">{course.maxStudents}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Start Date</p>
          <p className="font-medium text-dark-gray">
            {course.startDate
              ? course.startDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Not scheduled'}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Enrolled</p>
          <p className="font-medium text-dark-gray">
            {course.enrollments.length} / {course.maxStudents}
          </p>
        </div>
        {course.description && (
          <div className="md:col-span-4">
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="text-dark-gray">{course.description}</p>
          </div>
        )}
      </div>

      {/* Students who registered interest in this course */}
      <div className="bg-white rounded-lg shadow-soft overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-poppins text-lg font-bold text-dark-gray">
            Students Registered for This Course
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Public registrations where preferred course = {course.level}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Phone</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Learning Mode</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Date</th>
              </tr>
            </thead>
            <tbody>
              {registrations.length > 0 ? (
                registrations.map((reg) => (
                  <tr key={reg.id} className="border-b border-border hover:bg-cream transition-colors">
                    <td className="px-6 py-4 font-medium text-dark-gray">
                      <Link
                        href={`/admin/registrations/${reg.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {reg.fullName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">{reg.email}</td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">{reg.phone}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {reg.learningMode || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          REGISTRATION_STATUS_STYLES[reg.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {reg.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {reg.createdAt.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No students have registered for this course yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enrolled students (real accounts) */}
      <div className="bg-white rounded-lg shadow-soft overflow-hidden">
        <div className="p-6 border-b border-border space-y-4">
          <div>
            <h3 className="font-poppins text-lg font-bold text-dark-gray">
              Enrolled Students
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Students with an account formally enrolled in this course
            </p>
          </div>
          <AssignStudentForm courseId={course.id} eligibleStudents={eligibleStudents} />
        </div>
        <EnrollmentsTable enrollments={course.enrollments} />
      </div>
    </div>
  )
}
