'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'

// Catches unexpected errors in any page, shows a friendly screen and a toast instead of a crash.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage()

  useEffect(() => {
    console.error(error)
    toast.error(t('feedback.errorTitle'), { id: `error-${error.digest ?? 'page'}` })
  }, [error, t])

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-cream">
      <div className="bg-white rounded-lg shadow-soft p-8 max-w-md w-full text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-primary mx-auto" />
        <h1 className="font-poppins text-2xl font-bold text-dark-gray">{t('feedback.errorTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('feedback.errorBody')}</p>
        {error.digest && <p className="text-xs text-muted-foreground font-mono">Ref: {error.digest}</p>}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={reset} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#E05530]">
            {t('feedback.tryAgain')}
          </button>
          <Link href="/" className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-cream">
            {t('feedback.goHome')}
          </Link>
        </div>
      </div>
    </main>
  )
}
