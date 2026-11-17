import { requireAdmin } from '@/app/actions/auth'
import { getStudent } from '@/app/actions/students'
import { StudentEditForm } from '@/components/forms/student-edit-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

export const metadata = {
  title: 'Edit Student | Admin Dashboard',
}

export default async function EditStudentPage({
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
    <div className="space-y-6 max-w-3xl">
      <Link
        href={`/admin/students/${student.id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Profile
      </Link>

      <div>
        <h2 className="font-poppins text-2xl font-bold text-dark-gray mb-2">
          Edit Student
        </h2>
        <p className="text-muted-foreground">{student.user.name}</p>
      </div>

      <div className="bg-white rounded-lg shadow-soft p-8">
        <StudentEditForm student={student} />
      </div>
    </div>
  )
}
