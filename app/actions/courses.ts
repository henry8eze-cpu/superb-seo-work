'use server'

import { prisma } from '@/lib/prisma'
import { courseSchema } from '@/lib/validations'
import { requireAdmin } from './auth'
import { revalidatePath } from 'next/cache'

export async function createCourse(formData: unknown) {
  await requireAdmin()

  try {
    const data = await courseSchema.parseAsync(formData)

    const course = await prisma.course.create({
      data: {
        name: data.name,
        language: data.language,
        level: data.level,
        description: data.description || null,
        duration: data.duration,
        price: data.price,
        maxStudents: data.maxStudents,
        status: data.status,
        instructorId: data.instructorId || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
      },
    })

    revalidatePath('/admin/courses')
    revalidatePath('/admin')

    return {
      success: true,
      courseId: course.id,
    }
  } catch (error) {
    console.error('[v0] Create course error:', error)
    return {
      success: false,
      error: 'Failed to create course. Please check the form and try again.',
    }
  }
}

export async function updateCourse(id: string, formData: unknown) {
  await requireAdmin()

  try {
    const data = await courseSchema.parseAsync(formData)

    await prisma.course.update({
      where: { id },
      data: {
        name: data.name,
        language: data.language,
        level: data.level,
        description: data.description || null,
        duration: data.duration,
        price: data.price,
        maxStudents: data.maxStudents,
        status: data.status,
        instructorId: data.instructorId || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
      },
    })

    revalidatePath('/admin/courses')
    revalidatePath(`/admin/courses/${id}`)

    return {
      success: true,
    }
  } catch (error) {
    console.error('[v0] Update course error:', error)
    return {
      success: false,
      error: 'Failed to update course. Please check the form and try again.',
    }
  }
}

export async function deleteCourse(id: string) {
  await requireAdmin()

  try {
    await prisma.course.delete({ where: { id } })

    revalidatePath('/admin/courses')
    revalidatePath('/admin')

    return { success: true }
  } catch (error) {
    console.error('[v0] Delete course error:', error)
    return {
      success: false,
      error: 'Failed to delete course. It may still have enrolled students.',
    }
  }
}

export async function enrollStudent(courseId: string, studentId: string) {
  await requireAdmin()

  try {
    const existing = await prisma.enrollment.findFirst({
      where: { courseId, studentId },
    })

    if (existing) {
      return { success: false, error: 'Student is already enrolled in this course' }
    }

    await prisma.enrollment.create({
      data: { courseId, studentId },
    })

    revalidatePath(`/admin/courses/${courseId}`)
    revalidatePath('/admin/students')
    revalidatePath('/admin')

    return { success: true }
  } catch (error) {
    console.error('[v0] Enroll student error:', error)
    return { success: false, error: 'Failed to enroll student' }
  }
}

export async function unenrollStudent(enrollmentId: string) {
  await requireAdmin()

  try {
    const enrollment = await prisma.enrollment.delete({
      where: { id: enrollmentId },
    })

    revalidatePath(`/admin/courses/${enrollment.courseId}`)
    revalidatePath('/admin/students')
    revalidatePath('/admin')

    return { success: true }
  } catch (error) {
    console.error('[v0] Unenroll student error:', error)
    return { success: false, error: 'Failed to remove enrollment' }
  }
}

export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: 'ACTIVE' | 'COMPLETED' | 'DROPPED'
) {
  await requireAdmin()

  try {
    const enrollment = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status },
    })

    revalidatePath(`/admin/courses/${enrollment.courseId}`)
    revalidatePath('/admin/students')

    return { success: true }
  } catch (error) {
    console.error('[v0] Update enrollment status error:', error)
    return { success: false, error: 'Failed to update enrollment status' }
  }
}

export async function updateEnrollmentPayment(
  enrollmentId: string,
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID'
) {
  await requireAdmin()

  try {
    const enrollment = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { paymentStatus },
    })

    revalidatePath(`/admin/courses/${enrollment.courseId}`)
    revalidatePath('/admin/students')

    return { success: true }
  } catch (error) {
    console.error('[v0] Update payment status error:', error)
    return { success: false, error: 'Failed to update payment status' }
  }
}
