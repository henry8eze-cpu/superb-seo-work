import { requireAdmin } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { CourseForm } from '@/components/forms/course-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

export const metadata = {
  title: 'Edit Course | Admin Dashboard',
}

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const [course, instructors] = await Promise.all([
    prisma.course.findUnique({ where: { id } }),
    prisma.instructor.findMany({
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  if (!course) {
    notFound()
  }

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
          Edit Course
        </h2>
        <p className="text-muted-foreground">{course.name}</p>
      </div>

      <div className="bg-white rounded-lg shadow-soft p-8">
        <CourseForm course={course} instructors={instructors} />
      </div>
    </div>
  )
}
