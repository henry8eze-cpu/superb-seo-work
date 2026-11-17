'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { updateSettings } from '@/app/actions/settings'
import { settingsSchema, SettingsFormData } from '@/lib/validations'
import { Loader2 } from 'lucide-react'

export function SettingsForm({ settings }: { settings: SettingsFormData }) {
  const [submitError, setSubmitError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  })

  const onSubmit = async (data: SettingsFormData) => {
    setSubmitError('')
    const result = await updateSettings(data)

    if (result.success) {
      toast.success('Settings saved')
    } else {
      setSubmitError(result.error || 'Something went wrong')
      toast.error(result.error || 'Something went wrong')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {submitError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{submitError}</div>
      )}

      {/* School Info */}
      <div className="bg-white rounded-lg shadow-soft p-8">
        <h3 className="font-poppins text-lg font-bold text-dark-gray mb-6">
          School &amp; Contact Information
        </h3>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-dark-gray mb-2">School Name</label>
            <input
              {...register('schoolName')}
              type="text"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.schoolName && (
              <p className="text-red-500 text-xs mt-1">{errors.schoolName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray mb-2">Contact Email</label>
            <input
              {...register('contactEmail')}
              type="email"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.contactEmail && (
              <p className="text-red-500 text-xs mt-1">{errors.contactEmail.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray mb-2">Phone Number</label>
            <input
              {...register('contactPhone')}
              type="tel"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Languages & Levels */}
      <div className="bg-white rounded-lg shadow-soft p-8">
        <h3 className="font-poppins text-lg font-bold text-dark-gray mb-6">
          Languages &amp; Course Levels
        </h3>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-dark-gray mb-2">
              Available Languages
            </label>
            <input
              {...register('availableLanguages')}
              type="text"
              placeholder="e.g. German, English"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated list</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray mb-2">
              Course Levels
            </label>
            <input
              {...register('courseLevels')}
              type="text"
              placeholder="e.g. A1, A2, B1, B2, C1, C2"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated list</p>
          </div>
        </div>
      </div>

      {/* Registration Settings */}
      <div className="bg-white rounded-lg shadow-soft p-8">
        <h3 className="font-poppins text-lg font-bold text-dark-gray mb-6">
          Registration Settings
        </h3>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            {...register('registrationOpen')}
            type="checkbox"
            className="w-4 h-4"
          />
          <span className="text-dark-gray font-medium">
            Accept new public registrations
          </span>
        </label>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-lg shadow-soft p-8">
        <h3 className="font-poppins text-lg font-bold text-dark-gray mb-6">
          Email Notifications
        </h3>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              {...register('notifyOnRegistration')}
              type="checkbox"
              className="w-4 h-4"
            />
            <span className="text-dark-gray font-medium">
              Send emails on new registrations
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              {...register('notifyOnEnrollment')}
              type="checkbox"
              className="w-4 h-4"
            />
            <span className="text-dark-gray font-medium">
              Send emails on course enrollments
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary text-white font-medium py-2 px-6 rounded-lg hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Save Changes
      </button>
    </form>
  )
}
