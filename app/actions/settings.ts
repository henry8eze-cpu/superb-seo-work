'use server'

import { prisma } from '@/lib/prisma'
import { settingsSchema, SettingsFormData } from '@/lib/validations'
import { requireAdmin } from './auth'
import { revalidatePath } from 'next/cache'

const DEFAULT_SETTINGS: SettingsFormData = {
  schoolName: 'Superb Sprachschule',
  contactEmail: 'info@superb-sprachschule.de',
  contactPhone: '+49 176 74865418',
  availableLanguages: 'German',
  courseLevels: 'A1,A2,B1,B2,C1,C2,GOETHE',
  registrationOpen: true,
  notifyOnRegistration: true,
  notifyOnEnrollment: true,
}

const BOOLEAN_KEYS: (keyof SettingsFormData)[] = [
  'registrationOpen',
  'notifyOnRegistration',
  'notifyOnEnrollment',
]

export async function getSettings(): Promise<SettingsFormData> {
  await requireAdmin()

  const rows = await prisma.setting.findMany()
  const stored: Record<string, string> = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  const result: SettingsFormData = { ...DEFAULT_SETTINGS }

  for (const [key, value] of Object.entries(stored)) {
    if ((BOOLEAN_KEYS as string[]).includes(key)) {
      ;(result as any)[key] = value === 'true'
    } else if (key in result) {
      ;(result as any)[key] = value
    }
  }

  return result
}

export async function updateSettings(formData: unknown) {
  await requireAdmin()

  try {
    const data = await settingsSchema.parseAsync(formData)

    await prisma.$transaction(
      Object.entries(data).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    )

    revalidatePath('/admin/settings')

    return { success: true }
  } catch (error) {
    console.error('[v0] Update settings error:', error)
    return {
      success: false,
      error: 'Failed to save settings. Please check the form and try again.',
    }
  }
}
