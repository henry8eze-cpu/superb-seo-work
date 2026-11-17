import { z } from 'zod'

export const registrationSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 characters'),
  country: z.string().optional(),
  preferredCourse: z.string().optional(),
  germanLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  learningMode: z.enum(['ONLINE', 'INPERSON', 'HYBRID']).optional(),
  preferredClassTime: z.string().optional(),
  additionalMessage: z.string().optional(),
})

export type RegistrationFormData = z.infer<typeof registrationSchema>

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type SignupFormData = z.infer<typeof signupSchema>

export const courseSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  language: z.string().min(1).default('German'),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'GOETHE']),
  description: z.string().optional(),
  duration: z.coerce.number().int().positive('Duration must be a positive number'),
  price: z.coerce.number().positive('Price must be a positive number'),
  maxStudents: z.coerce.number().int().positive('Max students must be a positive number'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  instructorId: z.string().optional(),
  startDate: z.string().optional(),
})

export type CourseFormData = z.infer<typeof courseSchema>

export const studentUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  country: z.string().optional(),
  dateOfBirth: z.string().optional(),
  germanLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  learningMode: z.enum(['ONLINE', 'INPERSON', 'HYBRID']).optional(),
  preferredClassTime: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'COMPLETED']),
})

export type StudentUpdateFormData = z.infer<typeof studentUpdateSchema>

export const noteSchema = z.object({
  content: z.string().min(1, 'Note cannot be empty'),
})

export const settingsSchema = z.object({
  schoolName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  availableLanguages: z.string().min(1),
  courseLevels: z.string().min(1),
  registrationOpen: z.boolean(),
  notifyOnRegistration: z.boolean(),
  notifyOnEnrollment: z.boolean(),
})

export type SettingsFormData = z.infer<typeof settingsSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
