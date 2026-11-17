'use client'

import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { cn } from '@/lib/utils'

/** A password field with a show/hide button. Accepts every <input> prop, including react-hook-form's ref. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  const { t } = useLanguage()
  const label = visible ? t('common.hidePassword') : t('common.showPassword')
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={cn(className, 'pe-11')} autoComplete={props.autoComplete} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        disabled={props.disabled}
        className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-dark-gray focus:outline-none focus-visible:text-primary disabled:opacity-50"
      >
        {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  )
}
