import { z } from 'zod'

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))

export const SCHOOL_TYPES = ['PRIVATE', 'VHS', 'UNIVERSITY', 'NON_PROFIT', 'OTHER'] as const
export const SOURCE_TYPES = [
  'SCHOOL_WEBSITE',
  'PUBLIC_REGISTRY',
  'VHS_DIRECTORY',
  'BAMF_LIST',
  'PHONE_CALL',
  'EMAIL',
  'SCHOOL_PROVIDED',
  'IMPORT',
  'OTHER',
] as const
export const COURSE_CATEGORIES = ['STANDARD', 'INTENSIVE', 'EVENING', 'WEEKEND', 'PRIVATE', 'EXAM_PREP', 'INTEGRATION'] as const
export const CONTACT_CHANNELS = ['EMAIL', 'PHONE', 'VISIT', 'CONTACT_FORM', 'OTHER'] as const
export const CONTACT_OUTCOMES = ['NO_RESPONSE', 'INTERESTED', 'NOT_INTERESTED', 'CALL_BACK', 'INVITED', 'WRONG_CONTACT', 'OTHER'] as const

export const schoolDetailsSchema = z.object({
  name: z.string().trim().min(2),
  legalName: optionalText,
  description: optionalText,
  website: optionalText,
  publicEmail: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.string().email().optional()),
  phone: optionalText,
  schoolType: z.enum(SCHOOL_TYPES),
  cityId: optionalText,
  languagesOffered: z.array(z.string().trim().min(2).max(5)).default([]),
  courseTypesOffered: z.array(z.enum(COURSE_CATEGORIES)).default([]),
})
export type SchoolDetailsInput = z.input<typeof schoolDetailsSchema>

export const researchSourceSchema = z.object({
  field: optionalText,
  url: optionalText,
  sourceType: z.enum(SOURCE_TYPES),
  retrievedAt: optionalText,
  notes: optionalText,
})
export type ResearchSourceInput = z.input<typeof researchSourceSchema>

export const contactAttemptSchema = z.object({
  channel: z.enum(CONTACT_CHANNELS),
  outcome: z.enum(CONTACT_OUTCOMES),
  contactedAt: optionalText,
  notes: optionalText,
  nextStep: optionalText,
  nextStepDate: optionalText,
})
export type ContactAttemptInput = z.input<typeof contactAttemptSchema>

export const staffContactSchema = z.object({
  name: z.string().trim().min(2),
  position: optionalText,
  email: optionalText,
  phone: optionalText,
  notes: optionalText,
})
export type StaffContactInput = z.input<typeof staffContactSchema>

export const branchSchema = z.object({
  name: z.string().trim().min(2),
  isOnline: z.boolean().default(false),
  address: optionalText,
  postcode: optionalText,
  cityName: optionalText,
  phone: optionalText,
})
export type BranchInput = z.input<typeof branchSchema>

export const citySchema = z.object({
  name: z.string().trim().min(2),
  priority: z.coerce.number().int().min(0).max(1000).default(100),
})

export const claimSchema = z.object({
  claimantName: z.string().trim().min(2),
  claimantPosition: z.string().trim().min(2),
  claimantPhone: optionalText,
  message: optionalText,
  confirmAuthority: z.literal(true),
})
export type ClaimInput = z.input<typeof claimSchema>
