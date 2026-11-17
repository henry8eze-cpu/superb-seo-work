'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useTransition } from 'react'
import { updateEnrollmentStatus, updateEnrollmentPayment } from '@/app/actions/courses'
import { ConfirmDeleteButton } from '@/components/admin/confirm-delete-button'
import { unenrollStudent } from '@/app/actions/courses'

type Enrollment = {
  id: string
  status: string
  paymentStatus: string
  enrollmentDate: Date
  student: {
    id: string
    user: { name: string; email: string }
  }
}

export function EnrollmentsTable({ enrollments }: { enrollments: Enrollment[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleStatusChange = (enrollmentId: string, status: string) => {
    startTransition(async () => {
      const result = await updateEnrollmentStatus(
        enrollmentId,
        status as 'ACTIVE' | 'COMPLETED' | 'DROPPED'
      )
      if (result.success) {
        toast.success('Enrollment status updated')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to update status')
      }
    })
  }

  const handlePaymentChange = (enrollmentId: string, paymentStatus: string) => {
    startTransition(async () => {
      const result = await updateEnrollmentPayment(
        enrollmentId,
        paymentStatus as 'UNPAID' | 'PARTIAL' | 'PAID'
      )
      if (result.success) {
        toast.success('Payment status updated')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to update payment status')
      }
    })
  }

  if (enrollments.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground">
        No students formally enrolled yet
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-cream border-b border-border">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Name</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Email</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Status</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Payment</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Enrolled On</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">Action</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((enrollment) => (
            <tr key={enrollment.id} className="border-b border-border hover:bg-cream transition-colors">
              <td className="px-6 py-4 font-medium text-dark-gray">
                <Link
                  href={`/admin/students/${enrollment.student.id}`}
                  className="hover:text-primary hover:underline"
                >
                  {enrollment.student.user.name}
                </Link>
              </td>
              <td className="px-6 py-4 text-muted-foreground text-sm">
                {enrollment.student.user.email}
              </td>
              <td className="px-6 py-4">
                <select
                  value={enrollment.status}
                  disabled={isPending}
                  onChange={(e) => handleStatusChange(enrollment.id, e.target.value)}
                  className="text-xs font-semibold px-2 py-1 rounded-lg border border-border bg-white disabled:opacity-50"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DROPPED">Dropped</option>
                </select>
              </td>
              <td className="px-6 py-4">
                <select
                  value={enrollment.paymentStatus}
                  disabled={isPending}
                  onChange={(e) => handlePaymentChange(enrollment.id, e.target.value)}
                  className="text-xs font-semibold px-2 py-1 rounded-lg border border-border bg-white disabled:opacity-50"
                >
                  <option value="UNPAID">Unpaid</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="PAID">Paid</option>
                </select>
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                {enrollment.enrollmentDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </td>
              <td className="px-6 py-4">
                <ConfirmDeleteButton
                  title="Remove enrollment"
                  description={`Remove ${enrollment.student.user.name} from this course? This does not delete their student account.`}
                  confirmLabel="Remove"
                  triggerLabel="Remove"
                  triggerClassName="text-red-600 text-sm font-medium hover:underline"
                  action={() => unenrollStudent(enrollment.id)}
                  onDone={() => router.refresh()}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
