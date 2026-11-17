'use client'

import { PasswordInput } from '@/components/app/password-input'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { changeAdminPassword } from '@/app/actions/auth'
import { changePasswordSchema, ChangePasswordFormData } from '@/lib/validations'
import { Loader2 } from 'lucide-react'

export function ChangePasswordForm() {
  const [submitError, setSubmitError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onSubmit = async (data: ChangePasswordFormData) => {
    setSubmitError('')
    const result = await changeAdminPassword(data)

    if (result.success) {
      toast.success('Password changed')
      reset()
    } else {
      setSubmitError(result.error || 'Something went wrong')
      toast.error(result.error || 'Something went wrong')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      {submitError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{submitError}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-dark-gray mb-2">
          Current Password
        </label>
        <PasswordInput
          {...register('currentPassword')}
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {errors.currentPassword && (
          <p className="text-red-500 text-xs mt-1">{errors.currentPassword.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-gray mb-2">New Password</label>
        <PasswordInput
          {...register('newPassword')}
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {errors.newPassword && (
          <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-gray mb-2">
          Confirm New Password
        </label>
        <PasswordInput
          {...register('confirmPassword')}
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {errors.confirmPassword && (
          <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary text-white font-medium py-2 px-6 rounded-lg hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Change Password
      </button>
    </form>
  )
}
