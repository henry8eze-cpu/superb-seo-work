'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { enrollStudent } from '@/app/actions/courses'
import { Loader2, UserPlus } from 'lucide-react'

type EligibleStudent = {
  id: string
  user: { name: string; email: string }
}

export function AssignStudentForm({
  courseId,
  eligibleStudents,
}: {
  courseId: string
  eligibleStudents: EligibleStudent[]
}) {
  const router = useRouter()
  const [studentId, setStudentId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId) return

    setIsSubmitting(true)
    const result = await enrollStudent(courseId, studentId)
    setIsSubmitting(false)

    if (result.success) {
      toast.success('Student enrolled')
      setStudentId('')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to enroll student')
    }
  }

  if (eligibleStudents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        All existing students are already enrolled in this course.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <select
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
        className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
      >
        <option value="">Select a student to enroll...</option>
        {eligibleStudents.map((student) => (
          <option key={student.id} value={student.id}>
            {student.user.name} ({student.user.email})
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!studentId || isSubmitting}
        className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <UserPlus className="w-4 h-4" />
        )}
        Enroll
      </button>
    </form>
  )
}
