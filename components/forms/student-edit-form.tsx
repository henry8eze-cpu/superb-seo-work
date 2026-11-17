'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { updateStudent } from '@/app/actions/students'
import { studentUpdateSchema, StudentUpdateFormData } from '@/lib/validations'
import { Loader2 } from 'lucide-react'

export function StudentEditForm({
  student,
}: {
  student: {
    id: string
    user: { name: string; email: string }
    phone: string | null
    country: string | null
    dateOfBirth: Date | null
    germanLevel: string | null
    learningMode: string | null
    preferredClassTime: string | null
    status: string
  }
}) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StudentUpdateFormData>({
    resolver: zodResolver(studentUpdateSchema),
    defaultValues: {
      name: student.user.name,
      email: student.user.email,
      phone: student.phone || '',
      country: student.country || '',
      dateOfBirth: student.dateOfBirth
        ? new Date(student.dateOfBirth).toISOString().split('T')[0]
        : '',
      germanLevel: (student.germanLevel as StudentUpdateFormData['germanLevel']) || undefined,
      learningMode: (student.learningMode as StudentUpdateFormData['learningMode']) || undefined,
      preferredClassTime: student.preferredClassTime || '',
      status: student.status as StudentUpdateFormData['status'],
    },
  })

  const onSubmit = async (data: StudentUpdateFormData) => {
    setSubmitError('')

    const result = await updateStudent(student.id, data)

    if (result.success) {
      toast.success('Student updated')
      router.push(`/admin/students/${student.id}`)
      router.refresh()
    } else {
      setSubmitError(result.error || 'Something went wrong')
      toast.error(result.error || 'Something went wrong')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {submitError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{submitError}</div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Full Name *</label>
          <input
            {...register('name')}
            type="text"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.name ? 'border-red-500' : 'border-border'
            }`}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email *</label>
          <input
            {...register('email')}
            type="email"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.email ? 'border-red-500' : 'border-border'
            }`}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Phone</label>
          <input
            {...register('phone')}
            type="tel"
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Country</label>
          <input
            {...register('country')}
            type="text"
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Date of Birth</label>
          <input
            {...register('dateOfBirth')}
            type="date"
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">German Level</label>
          <select
            {...register('germanLevel')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            <option value="">Not set</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Learning Mode</label>
          <select
            {...register('learningMode')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            <option value="">Not set</option>
            <option value="ONLINE">Online</option>
            <option value="INPERSON">In-Person</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Preferred Class Time</label>
          <input
            {...register('preferredClassTime')}
            type="text"
            placeholder="e.g. Evenings, Weekends"
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Status *</label>
          <select
            {...register('status')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary text-white font-medium py-3 rounded-lg hover:bg-[#E05530] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Changes'
        )}
      </button>
    </form>
  )
}
