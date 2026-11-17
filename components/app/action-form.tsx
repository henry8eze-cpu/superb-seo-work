'use client'

import { useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/language-context'
import { buttonClass, dangerButtonClass, secondaryButtonClass } from './ui'

export type ActionResponse = { success: true; data?: unknown; message?: string } | { success: false; error: string; code?: string }

type Translate = ReturnType<typeof useLanguage>['t']

/**
 * Calls a server action and reports the outcome as a toast.
 * Returns the successful result, or null when it failed or the server redirected
 * (a redirecting action resolves without a value; the new page shows its own feedback).
 */
async function runWithFeedback(
  call: () => Promise<ActionResponse | undefined>,
  t: Translate,
  options: { successMessage?: string; silent?: boolean }
) {
  let result: ActionResponse | undefined
  try {
    result = await call()
  } catch (error) {
    console.error('[action] request failed', error)
    toast.error(t('feedback.networkError'))
    return { failed: true as const, error: t('feedback.networkError') }
  }
  if (!result) return null
  if (!result.success) {
    toast.error(result.error)
    return { failed: true as const, error: result.error }
  }
  const message = result.message ?? options.successMessage ?? (options.silent ? undefined : t('feedback.saved'))
  if (message) toast.success(message)
  return { failed: false as const, result }
}

/**
 * A plain <form> that submits its FormData to a server action, shows the
 * outcome as a toast and refreshes (or navigates) on success.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  successMessage,
  redirectTo,
  resetOnSuccess,
  confirmMessage,
  className,
  submitClassName,
  variant = 'primary',
  encType,
  silent,
}: {
  action: (form: FormData) => Promise<ActionResponse>
  children?: ReactNode
  submitLabel: ReactNode
  successMessage?: string
  /** Where to go on success. ":id" is replaced with the action's returned data (e.g. a new record id). */
  redirectTo?: string
  resetOnSuccess?: boolean
  confirmMessage?: string
  className?: string
  submitClassName?: string
  variant?: 'primary' | 'secondary' | 'danger'
  encType?: string
  /** No default "Saved" toast (e.g. forms that redirect to a page with its own feedback). */
  silent?: boolean
}) {
  const router = useRouter()
  const { t } = useLanguage()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (confirmMessage && !window.confirm(confirmMessage)) return
    const form = new FormData(event.currentTarget)
    setError('')
    startTransition(async () => {
      const outcome = await runWithFeedback(() => action(form), t, { successMessage, silent: silent || !!redirectTo && !successMessage })
      if (!outcome) return
      if (outcome.failed) {
        setError(outcome.error)
        return
      }
      if (resetOnSuccess) formRef.current?.reset()
      const target = redirectTo?.replace(':id', encodeURIComponent(String(outcome.result.data ?? '')))
      if (target) router.push(target)
      router.refresh()
    })
  }

  const buttonStyle = variant === 'danger' ? dangerButtonClass : variant === 'secondary' ? secondaryButtonClass : buttonClass

  return (
    <form ref={formRef} onSubmit={onSubmit} className={cn('space-y-4', className)} encType={encType}>
      {children}
      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={cn(buttonStyle, submitClassName)}>
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitLabel}
      </button>
    </form>
  )
}

/** A single button bound to a server action, e.g. "Pause bookings". */
export function ActionButton({
  action,
  children,
  confirmMessage,
  successMessage,
  variant = 'secondary',
  redirectTo,
  className,
  silent,
}: {
  action: () => Promise<ActionResponse>
  children: ReactNode
  confirmMessage?: string
  successMessage?: string
  variant?: 'primary' | 'secondary' | 'danger'
  redirectTo?: string
  className?: string
  silent?: boolean
}) {
  const router = useRouter()
  const { t } = useLanguage()
  const [pending, startTransition] = useTransition()
  const style = variant === 'danger' ? dangerButtonClass : variant === 'primary' ? buttonClass : secondaryButtonClass
  return (
    <button
      type="button"
      disabled={pending}
      className={cn(style, className)}
      onClick={() => {
        if (confirmMessage && !window.confirm(confirmMessage)) return
        startTransition(async () => {
          const outcome = await runWithFeedback(action, t, { successMessage, silent })
          if (!outcome || outcome.failed) return
          if (redirectTo) router.push(redirectTo)
          router.refresh()
        })
      }}
    >
      {pending && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}
