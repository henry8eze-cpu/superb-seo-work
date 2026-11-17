'use client'

import { PasswordInput } from '@/components/app/password-input'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { loginUser } from '@/app/actions/auth'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/language-context'
import { LanguageSwitcher } from '@/components/language-switcher'

export default function LoginPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Carries ?callbackUrl= over to the signup link (read after mount to avoid a hydration mismatch).
  const [search, setSearch] = useState('')
  useEffect(() => setSearch(window.location.search), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await loginUser(email, password)

      if (result.success) {
        // Only same-site paths, so the login page can't be used as an open redirect.
        const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl')
        const safeCallback = callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : null
        toast.success(t('feedback.loggedIn', { name: result.name }))
        router.push(safeCallback ?? result.redirectTo ?? '/account')
        router.refresh()
      } else {
        setError(t('feedback.loginFailed'))
        toast.error(t('feedback.loginFailed'))
      }
    } catch (err) {
      setError(t('feedback.networkError'))
      toast.error(t('feedback.networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <div className="bg-white rounded-lg shadow-soft p-8">
          <h1 className="font-poppins text-3xl font-bold text-primary mb-2">
            {t('forms.login.title')}
          </h1>
          <p className="text-muted-foreground mb-8">
            {t('forms.login.subtitle')}
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                {t('forms.login.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                {t('forms.login.password')}
              </label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-medium py-2 rounded-lg hover:bg-[#E05530] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                t('forms.login.login')
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('forms.login.noAccount')}{' '}
              <Link href={`/auth/signup${search}`} className="text-primary font-medium hover:underline">
                {t('forms.login.signupLink')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
