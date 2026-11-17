'use server'

import { prisma } from '@/lib/prisma'
import { registrationSchema, noteSchema } from '@/lib/validations'
import { sendRegistrationConfirmation, sendAdminRegistrationNotification, sendRegistrationStatusUpdate } from '@/lib/email'
import { requireAdmin } from './auth'
import { revalidatePath } from 'next/cache'

export async function createRegistration(formData: unknown) {
  try {
    const validatedData = await registrationSchema.parseAsync(formData)

    const registration = await prisma.registration.create({
      data: {
        fullName: validatedData.fullName,
        email: validatedData.email,
        phone: validatedData.phone,
        country: validatedData.country,
        preferredCourse: validatedData.preferredCourse,
        germanLevel: validatedData.germanLevel,
        learningMode: validatedData.learningMode,
        preferredClassTime: validatedData.preferredClassTime,
        additionalMessage: validatedData.additionalMessage,
        status: 'NEW',
      },
    })

    // Send confirmation email to student
    await sendRegistrationConfirmation(
      validatedData.email,
      validatedData.fullName,
      validatedData.preferredCourse
    )

    // Send notification to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@superb-sprachschule.de'
    await sendAdminRegistrationNotification(
      adminEmail,
      validatedData.fullName,
      validatedData.email,
      validatedData.phone,
      validatedData.germanLevel
    )

    return {
      success: true,
      registrationId: registration.id,
      message: 'Thank you for your registration! We will contact you soon.',
    }
  } catch (error) {
    console.error('[v0] Registration error:', error)
    return {
      success: false,
      error: 'Registration failed. Please try again.',
    }
  }
}


export async function getRegistration(id: string) {
  await requireAdmin()

  return prisma.registration.findUnique({
    where: { id },
    include: {
      adminNotes: {
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Pending',
  CONTACTED: 'Contacted',
  ACCEPTED: 'Approved',
  ON_HOLD: 'On Hold',
  ENROLLED: 'Enrolled',
  REJECTED: 'Rejected',
}

export async function updateRegistrationStatus(
  id: string,
  status: 'NEW' | 'CONTACTED' | 'ACCEPTED' | 'ON_HOLD' | 'ENROLLED' | 'REJECTED'
) {
  const admin = await requireAdmin()

  try {
    const registration = await prisma.registration.findUnique({ where: { id } })
    if (!registration) {
      return { success: false, error: 'Application not found' }
    }

    await prisma.$transaction([
      prisma.registration.update({ where: { id }, data: { status } }),
      prisma.adminNote.create({
        data: {
          registrationId: id,
          userId: admin.id,
          content: `Status changed: ${STATUS_LABELS[registration.status]} → ${STATUS_LABELS[status]}`,
        },
      }),
    ])

    try {
      await sendRegistrationStatusUpdate(registration.email, registration.fullName, status)
    } catch (emailError) {
      console.error('[v0] Failed to send status update email:', emailError)
    }

    revalidatePath('/admin/registrations')
    revalidatePath(`/admin/registrations/${id}`)
    revalidatePath('/admin')

    return { success: true }
  } catch (error) {
    console.error('[v0] Update registration status error:', error)
    return { success: false, error: 'Failed to update application status' }
  }
}

export async function addRegistrationNote(registrationId: string, formData: unknown) {
  const admin = await requireAdmin()

  try {
    const data = await noteSchema.parseAsync(formData)

    await prisma.adminNote.create({
      data: {
        registrationId,
        userId: admin.id,
        content: data.content,
      },
    })

    revalidatePath(`/admin/registrations/${registrationId}`)

    return { success: true }
  } catch (error) {
    console.error('[v0] Add registration note error:', error)
    return { success: false, error: 'Failed to add note' }
  }
}
