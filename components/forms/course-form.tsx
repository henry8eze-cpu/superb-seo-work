'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCourse, updateCourse } from '@/app/actions/courses'
import { courseSchema, CourseFormData } from '@/lib/validations'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { z } from 'zod'

type CourseFormInput = z.input<typeof courseSchema>

type Instructor = {
  id: string
  user: { name: string }
}

export function CourseForm({
  course,
  instructors,
}: {
  course?: {
    id: string
    name: string
    language: string
    level: string
    description: string | null
    duration: number
    price: number
    maxStudents: number
    status: string
    instructorId: string | null
    startDate: Date | null
  }
  instructors: Instructor[]
}) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CourseFormInput, any, CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: course
      ? {
          name: course.name,
          language: course.language,
          level: course.level as CourseFormData['level'],
          description: course.description || '',
          duration: course.duration,
          price: course.price,
          maxStudents: course.maxStudents,
          status: course.status as CourseFormData['status'],
          instructorId: course.instructorId || '',
          startDate: course.startDate
            ? new Date(course.startDate).toISOString().split('T')[0]
            : '',
        }
      : {
          language: 'German',
          maxStudents: 15,
          status: 'ACTIVE',
        },
  })

  const onSubmit = async (data: CourseFormData) => {
    setSubmitError('')

    const result = course
      ? await updateCourse(course.id, data)
      : await createCourse(data)

    if (result.success) {
      toast.success(course ? 'Course updated' : 'Course created')
      router.push('/admin/courses')
      router.refresh()
    } else {
      setSubmitError(result.error || 'Something went wrong')
      toast.error(result.error || 'Something went wrong')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {submitError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
          {submitError}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Course Name *</label>
          <input
            {...register('name')}
            type="text"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.name ? 'border-red-500' : 'border-border'
            }`}
            placeholder="e.g. German A1 Beginner"
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Level *</label>
          <select
            {...register('level')}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white ${
              errors.level ? 'border-red-500' : 'border-border'
            }`}
          >
            <option value="">Select level</option>
            <option value="A1">A1 - Beginner</option>
            <option value="A2">A2 - Elementary</option>
            <option value="B1">B1 - Intermediate</option>
            <option value="B2">B2 - Upper Intermediate</option>
            <option value="C1">C1 - Advanced</option>
            <option value="C2">C2 - Mastery</option>
            <option value="GOETHE">Goethe Exam Prep</option>
          </select>
          {errors.level && (
            <p className="text-red-500 text-xs mt-1">{errors.level.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Price (€) *</label>
          <input
            {...register('price')}
            type="number"
            step="0.01"
            min="0"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.price ? 'border-red-500' : 'border-border'
            }`}
            placeholder="199"
          />
          {errors.price && (
            <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Duration (hours) *</label>
          <input
            {...register('duration')}
            type="number"
            min="1"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.duration ? 'border-red-500' : 'border-border'
            }`}
            placeholder="40"
          />
          {errors.duration && (
            <p className="text-red-500 text-xs mt-1">{errors.duration.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Max Students *</label>
          <input
            {...register('maxStudents')}
            type="number"
            min="1"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.maxStudents ? 'border-red-500' : 'border-border'
            }`}
            placeholder="15"
          />
          {errors.maxStudents && (
            <p className="text-red-500 text-xs mt-1">{errors.maxStudents.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Start Date</label>
          <input
            {...register('startDate')}
            type="date"
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Language *</label>
          <input
            {...register('language')}
            type="text"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.language ? 'border-red-500' : 'border-border'
            }`}
            placeholder="German"
          />
          {errors.language && (
            <p className="text-red-500 text-xs mt-1">{errors.language.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Availability *</label>
          <select
            {...register('status')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            <option value="ACTIVE">Active - open for enrollment</option>
            <option value="INACTIVE">Inactive - hidden / closed</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">Instructor</label>
          <select
            {...register('instructorId')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            <option value="">Unassigned</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.user.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            {...register('description')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="What students will learn in this course..."
            rows={4}
          />
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
        ) : course ? (
          'Save Changes'
        ) : (
          'Create Course'
        )}
      </button>
    </form>
  )
}
