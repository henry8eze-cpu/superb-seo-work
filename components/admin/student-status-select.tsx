'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { changeStudentStatus } from '@/app/actions/students'

export function StudentStatusSelect({
  studentId,
  status,
}: {
  studentId: string
  status: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleChange = (value: string) => {
    startTransition(async () => {
      const result = await changeStudentStatus(
        studentId,
        value as 'ACTIVE' | 'INACTIVE' | 'COMPLETED'
      )
      if (result.success) {
        toast.success('Student status updated')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to update status')
      }
    })
  }

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value)}
      className="text-sm font-semibold px-3 py-2 rounded-lg border border-border bg-white disabled:opacity-50"
    >
      <option value="ACTIVE">Active</option>
      <option value="INACTIVE">Inactive</option>
      <option value="COMPLETED">Completed</option>
    </select>
  )
}
