import { z } from 'zod'

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM')
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export const COURSE_FORMATS = ['IN_PERSON', 'ONLINE', 'HYBRID'] as const

export const courseTypeSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().trim().min(3),
  languageCode: z.string().trim().min(2).max(5).default('de'),
  level: z.enum(CEFR_LEVELS),
  category: z.enum(['STANDARD', 'INTENSIVE', 'EVENING', 'WEEKEND', 'PRIVATE', 'EXAM_PREP', 'INTEGRATION']),
  format: z.enum(COURSE_FORMATS),
  description: optionalText,
  lessonsPerWeek: z.coerce.number().int().min(1).max(60),
  lessonMinutes: z.coerce.number().int().min(15).max(300).default(45),
  cancellationTerms: z.string().trim().min(10),
})
export type CourseTypeInput = z.input<typeof courseTypeSchema>

export const intakeFeeSchema = z.object({
  label: z.string().trim().min(2),
  amountCents: z.number().int().min(0),
  compulsory: z.boolean().default(true),
})

export const intakeSchema = z
  .object({
    startDate: day,
    endDate: day,
    weekdays: z.array(z.number().int().min(1).max(7)).min(1),
    startTime: time,
    endTime: time,
    priceCents: z.number().int().min(0),
    capacity: z.coerce.number().int().min(1).max(500),
    bookingDeadline: optionalText, // datetime-local, Berlin time
    instantBooking: z.boolean().default(true),
    fees: z.array(intakeFeeSchema).max(10).default([]),
  })
  .refine((v) => v.endDate >= v.startDate, { message: 'End date must be on or after the start date', path: ['endDate'] })
  .refine((v) => v.endTime > v.startTime, { message: 'End time must be after the start time', path: ['endTime'] })
export type IntakeInput = z.input<typeof intakeSchema>

export const schoolProfileSchema = z.object({
  description: optionalText,
  website: optionalText,
  publicEmail: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.string().email().optional()),
  phone: optionalText,
})
