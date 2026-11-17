import { requireAuth } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { BookOpen, Award, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const user = await requireAuth()

  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    include: {
      enrollments: {
        include: {
          course: true,
        },
      },
      certificates: {
        include: {
          course: true,
        },
      },
    },
  })

  const enrollmentCount = student?.enrollments.length ?? 0
  const certificateCount = student?.certificates.length ?? 0
  const activeEnrollments = student?.enrollments.filter(
    (e) => e.status === 'ACTIVE'
  ) ?? []

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-soft p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium mb-1">
                Active Courses
              </p>
              <p className="font-poppins text-3xl font-bold text-dark-gray">
                {activeEnrollments.length}
              </p>
            </div>
            <div className="bg-secondary bg-opacity-10 p-3 rounded-lg">
              <BookOpen className="w-6 h-6 text-secondary" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-soft p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium mb-1">
                Certificates
              </p>
              <p className="font-poppins text-3xl font-bold text-dark-gray">
                {certificateCount}
              </p>
            </div>
            <div className="bg-primary bg-opacity-10 p-3 rounded-lg">
              <Award className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-soft p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium mb-1">
                Total Courses
              </p>
              <p className="font-poppins text-3xl font-bold text-dark-gray">
                {enrollmentCount}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Active Courses */}
      <div className="bg-white rounded-lg shadow-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-poppins text-xl font-bold text-dark-gray">
            Active Courses
          </h2>
          <Link
            href="/dashboard/courses"
            className="text-primary text-sm font-medium hover:underline"
          >
            View All
          </Link>
        </div>

        {activeEnrollments.length > 0 ? (
          <div className="space-y-4">
            {activeEnrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="border border-border rounded-lg p-4 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-poppins font-semibold text-dark-gray mb-1">
                      {enrollment.course.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Level: {enrollment.course.level} • Duration:{' '}
                      {enrollment.course.duration} hours
                    </p>
                  </div>
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-3 py-1 rounded-full">
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground mb-4">
              You are not enrolled in any courses yet.
            </p>
            <Link
              href="/register"
              className="text-primary font-medium hover:underline"
            >
              Browse Courses
            </Link>
          </div>
        )}
      </div>

      {/* Recent Certificates */}
      {certificateCount > 0 && (
        <div className="bg-white rounded-lg shadow-soft p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-poppins text-xl font-bold text-dark-gray">
              Recent Certificates
            </h2>
            <Link
              href="/dashboard/certificates"
              className="text-primary text-sm font-medium hover:underline"
            >
              View All
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {student!.certificates.slice(0, 2).map((cert) => (
              <div
                key={cert.id}
                className="border border-border rounded-lg p-4 text-center"
              >
                <Award className="w-8 h-8 text-secondary mx-auto mb-3" />
                <p className="font-semibold text-dark-gray mb-1">
                  {cert.course.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Issued:{' '}
                  {cert.issueDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
