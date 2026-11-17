'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createRegistration } from '@/app/actions/registrations'
import { registrationSchema, RegistrationFormData } from '@/lib/validations'
import { Loader2, CheckCircle } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { toast } from 'sonner'

export function RegistrationForm() {
  const { t } = useLanguage()
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
  })

  const onSubmit = async (data: RegistrationFormData) => {
    setSubmitError('')

    try {
      const result = await createRegistration(data)

      if (result.success) {
        setSubmitted(true)
        toast.success(t('feedback.registrationSent'))
        reset()
        setTimeout(() => setSubmitted(false), 5000)
      } else {
        setSubmitError(result.error || 'Something went wrong')
        toast.error(result.error || 'Something went wrong')
      }
    } catch (error) {
      setSubmitError(t('feedback.networkError'))
      toast.error(t('feedback.networkError'))
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-lg shadow-soft p-8 text-center">
        <CheckCircle className="w-16 h-16 text-secondary mx-auto mb-4" />
        <h3 className="font-poppins text-xl font-bold text-dark-gray mb-2">
          {t('forms.registration.success')}
        </h3>
        <p className="text-muted-foreground">
          {t('forms.registration.successMessage')}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, () => toast.error(t('feedback.checkForm')))} className="space-y-6">
      {submitError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
          {submitError}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">{t('forms.registration.fullName')} *</label>
          <input
            {...register('fullName')}
            type="text"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.fullName ? 'border-red-500' : 'border-border'
            }`}
            placeholder="Your full name"
          />
          {errors.fullName && (
            <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">{t('forms.registration.email')} *</label>
          <input
            {...register('email')}
            type="email"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.email ? 'border-red-500' : 'border-border'
            }`}
            placeholder="your@email.com"
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">{t('forms.registration.phone')} *</label>
          <input
            {...register('phone')}
            type="tel"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.phone ? 'border-red-500' : 'border-border'
            }`}
            placeholder="+1 (555) 123-4567"
          />
          {errors.phone && (
            <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">{t('forms.registration.country')}</label>
          <input
            {...register('country')}
            type="text"
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Your country"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">{t('forms.registration.preferredCourse')}</label>
          <select
            {...register('preferredCourse')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select a course</option>
            <option value="A1">A1 - Beginner</option>
            <option value="A2">A2 - Elementary</option>
            <option value="B1">B1 - Intermediate</option>
            <option value="B2">B2 - Upper Intermediate</option>
            <option value="C1">C1 - Advanced</option>
            <option value="C2">C2 - Mastery</option>
            <option value="GOETHE">Goethe Exam Prep</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">{t('forms.registration.germanLevel')}</label>
          <select
            {...register('germanLevel')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select level</option>
            <option value="A1">A1 - Beginner</option>
            <option value="A2">A2 - Elementary</option>
            <option value="B1">B1 - Intermediate</option>
            <option value="B2">B2 - Upper Intermediate</option>
            <option value="C1">C1 - Advanced</option>
            <option value="C2">C2 - Mastery</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">{t('forms.registration.learningMode')}</label>
          <select
            {...register('learningMode')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select mode</option>
            <option value="ONLINE">Online</option>
            <option value="INPERSON">In-Person</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">{t('forms.registration.preferredClassTime')}</label>
          <select
            {...register('preferredClassTime')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select time</option>
            <option value="morning">Morning (8am-12pm)</option>
            <option value="afternoon">Afternoon (1pm-5pm)</option>
            <option value="evening">Evening (6pm-9pm)</option>
            <option value="weekend">Weekend</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">{t('forms.registration.additionalMessage')}</label>
        <textarea
          {...register('additionalMessage')}
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Tell us more about your learning goals..."
          rows={4}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary text-white font-medium py-3 rounded-lg hover:bg-[#E05530] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </>
        ) : (
          t('forms.registration.register')
        )}
      </button>
    </form>
  )
}
