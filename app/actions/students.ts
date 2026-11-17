'use server'

import { prisma } from '@/lib/prisma'
import { studentUpdateSchema, noteSchema } from '@/lib/validations'
import { requireAdmin } from './auth'
import { revalidatePath } from 'next/cache'

export async function getStudent(id: string) {
  await requireAdmin()

  return prisma.student.findUnique({
    where: { id },
    include: {
      user: true,
      enrollments: {
        include: { course: true },
        orderBy: { enrollmentDate: 'desc' },
      },
      certificates: {
        include: { course: true },
        orderBy: { issueDate: 'desc' },
      },
      adminNotes: {
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function updateStudent(id: string, formData: unknown) {
  await requireAdmin()

  try {
    const data = await studentUpdateSchema.parseAsync(formData)

    const student = await prisma.student.findUnique({ where: { id } })
    if (!student) {
      return { success: false, error: 'Student not found' }
    }

    const emailTaken = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id: student.userId } },
    })
    if (emailTaken) {
      return { success: false, error: 'Email already in use by another account' }
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: student.userId },
        data: { name: data.name, email: data.email },
      }),
      prisma.student.update({
        where: { id },
        data: {
          phone: data.phone || null,
          country: data.country || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          germanLevel: data.germanLevel || null,
          learningMode: data.learningMode || null,
          preferredClassTime: data.preferredClassTime || null,
          status: data.status,
        },
      }),
    ])

    revalidatePath('/admin/students')
    revalidatePath(`/admin/students/${id}`)

    return { success: true }
  } catch (error) {
    console.error('[v0] Update student error:', error)
    return {
      success: false,
      error: 'Failed to update student. Please check the form and try again.',
    }
  }
}

export async function changeStudentStatus(
  id: string,
  status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED'
) {
  await requireAdmin()

  try {
    await prisma.student.update({ where: { id }, data: { status } })

    revalidatePath('/admin/students')
    revalidatePath(`/admin/students/${id}`)
    revalidatePath('/admin')

    return { success: true }
  } catch (error) {
    console.error('[v0] Change student status error:', error)
    return { success: false, error: 'Failed to update student status' }
  }
}

export async function deleteStudent(id: string) {
  await requireAdmin()

  try {
    const student = await prisma.student.findUnique({ where: { id } })
    if (!student) {
      return { success: false, error: 'Student not found' }
    }

    // Deleting the user cascades to the student profile, enrollments,
    // certificates, and admin notes.
    await prisma.user.delete({ where: { id: student.userId } })

    revalidatePath('/admin/students')
    revalidatePath('/admin')

    return { success: true }
  } catch (error) {
    console.error('[v0] Delete student error:', error)
    return { success: false, error: 'Failed to delete student' }
  }
}

export async function addStudentNote(studentId: string, formData: unknown) {
  const admin = await requireAdmin()

  try {
    const data = await noteSchema.parseAsync(formData)

    await prisma.adminNote.create({
      data: {
        studentId,
        userId: admin.id,
        content: data.content,
      },
    })

    revalidatePath(`/admin/students/${studentId}`)

    return { success: true }
  } catch (error) {
    console.error('[v0] Add student note error:', error)
    return { success: false, error: 'Failed to add note' }
  }
}
