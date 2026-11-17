'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/language-context'

const COOKIE = 'flash'

function readFlash() {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`))
  if (!match) return null
  document.cookie = `${COOKIE}=; path=/; max-age=0`
  try {
    const base64 = decodeURIComponent(match.slice(COOKIE.length + 1)).replace(/-/g, '+').replace(/_/g, '/')
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0)))
    return JSON.parse(json) as {
      kind: 'success' | 'error' | 'info'
      key: string
      vars?: Record<string, string | number>
    }
  } catch {
    return null
  }
}

/** Shows a toast queued by the server before a redirect, and a hint when a login was required. */
export function FlashToast() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useLanguage()

  useEffect(() => {
    const flash = readFlash()
    if (flash) toast[flash.kind](t(`feedback.${flash.key}`, flash.vars))
    if (pathname.startsWith('/auth/login') && searchParams.get('callbackUrl')) {
      toast.info(t('feedback.loginRequired'), { id: 'login-required' })
    }
    // Only re-run on navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  return null
}
