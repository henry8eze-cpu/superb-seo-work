import { requireAuth } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { BookOpen } from 'lucide-react'

export const metadata = {
  title: 'My Courses | Dashboard',
}

export default async function CoursesPage() {
  const user = await requireAuth()

  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    include: {
      enrollments: {
        include: {
          course: true,
        },
      },
    },
  })

  const enrollments = student?.enrollments ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-dark-gray mb-2">
          My Courses
        </h2>
        <p className="text-muted-foreground">
          View and manage all your enrolled courses
        </p>
      </div>

      {enrollments.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              className="bg-white rounded-lg shadow-soft overflow-hidden hover:shadow-premium transition-shadow"
            >
              <div className="bg-gradient-to-br from-primary to-secondary h-24"></div>

              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-poppins font-bold text-dark-gray mb-1">
                      {enrollment.course.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Level {enrollment.course.level}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4 text-sm text-muted-foreground">
                  <p>Duration: {enrollment.course.duration} hours</p>
                  <p>
                    Enrolled:{' '}
                    {enrollment.enrollmentDate.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      enrollment.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : enrollment.status === 'COMPLETED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {enrollment.status}
                  </span>
                </div>

                {enrollment.status === 'COMPLETED' && enrollment.certificateUrl && (
                  <button className="w-full mt-4 bg-secondary text-dark-gray font-medium py-2 rounded-lg hover:bg-opacity-80 transition-all">
                    Download Certificate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-soft p-12 text-center">
          <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
          <h3 className="font-poppins text-xl font-bold text-dark-gray mb-2">
            No Courses Yet
          </h3>
          <p className="text-muted-foreground mb-6">
            You haven&apos;t enrolled in any courses yet. Explore our course offerings.
          </p>
          <a
            href="/register"
            className="inline-block bg-primary text-white font-medium px-6 py-3 rounded-lg hover:bg-opacity-90 transition-all"
          >
            Browse Courses
          </a>
        </div>
      )}
    </div>
  )
}
