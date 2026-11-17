import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { CourseForm } from '@/components/forms/course-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'New Course | Admin Dashboard',
}

export default async function NewCoursePage() {
  await requireAdmin()

  const instructors = await prisma.instructor.findMany({
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/admin/courses"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Courses
      </Link>

      <div>
        <h2 className="font-poppins text-2xl font-bold text-dark-gray mb-2">
          New Course
        </h2>
        <p className="text-muted-foreground">
          Add a new course and set its price
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-soft p-8">
        <CourseForm instructors={instructors} />
      </div>
    </div>
  )
}
