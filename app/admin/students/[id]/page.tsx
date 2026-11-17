import { requireAdmin } from '@/app/actions/auth'
import { getStudent, deleteStudent } from '@/app/actions/students'
import { StudentStatusSelect } from '@/components/admin/student-status-select'
import { StudentNotes } from '@/components/admin/student-notes'
import { ConfirmDeleteButton } from '@/components/admin/confirm-delete-button'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Pencil, Mail, Phone, Globe, Cake } from 'lucide-react'

export const metadata = {
  title: 'Student Profile | Admin Dashboard',
}

const ENROLLMENT_STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  DROPPED: 'bg-red-100 text-red-800',
}

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  UNPAID: 'bg-red-100 text-red-800',
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const student = await getStudent(id)

  if (!student) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/students"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Students
      </Link>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-dark-gray mb-1">
            {student.user.name}
          </h2>
          <p className="text-muted-foreground">
            Registered {student.createdAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StudentStatusSelect studentId={student.id} status={student.status} />
          <Link
            href={`/admin/students/${student.id}/edit`}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-all text-sm font-medium"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Link>
          <ConfirmDeleteButton
            title="Delete student account"
            description={`This permanently deletes ${student.user.name}'s account, enrollments, certificates, and notes. This cannot be undone.`}
            action={deleteStudent.bind(null, student.id)}
          />
        </div>
      </div>

      {/* Profile Info */}
      <div className="bg-white rounded-lg shadow-soft p-6 grid md:grid-cols-3 gap-6">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground mb-1">Email</p>
            <p className="font-medium text-dark-gray">{student.user.email}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Phone className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground mb-1">Phone</p>
            <p className="font-medium text-dark-gray">{student.phone || 'Not provided'}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Cake className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground mb-1">Date of Birth</p>
            <p className="font-medium text-dark-gray">
              {student.dateOfBirth
                ? student.dateOfBirth.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Not provided'}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground mb-1">Country</p>
            <p className="font-medium text-dark-gray">{student.country || 'Not provided'}</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">German Level</p>
          <p className="font-medium text-dark-gray">{student.germanLevel || 'Not set'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Learning Mode</p>
          <p className="font-medium text-dark-gray">{student.learningMode || 'Not set'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Preferred Class Time</p>
          <p className="font-medium text-dark-gray">{student.preferredClassTime || 'Not set'}</p>
        </div>
      </div>

      {/* Enrollment History */}
      <div className="bg-white rounded-lg shadow-soft overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-poppins text-lg font-bold text-dark-gray">
            Enrollment History
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Course</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Level</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Payment</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Enrolled On</th>
              </tr>
            </thead>
            <tbody>
              {student.enrollments.length > 0 ? (
                student.enrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="border-b border-border hover:bg-cream transition-colors">
                    <td className="px-6 py-4 font-medium text-dark-gray">
                      <Link
                        href={`/admin/courses/${enrollment.course.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {enrollment.course.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {enrollment.course.level}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          ENROLLMENT_STATUS_STYLES[enrollment.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {enrollment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          PAYMENT_STATUS_STYLES[enrollment.paymentStatus] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {enrollment.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {enrollment.enrollmentDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Not enrolled in any courses yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StudentNotes studentId={student.id} notes={student.adminNotes} />
    </div>
  )
}
