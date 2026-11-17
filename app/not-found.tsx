import Link from 'next/link'
import { getT } from '@/lib/i18n/server'

export default async function NotFound() {
  const { t } = await getT()
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-cream">
      <div className="bg-white rounded-lg shadow-soft p-8 max-w-md w-full text-center space-y-4">
        <p className="font-poppins text-5xl font-bold text-primary">404</p>
        <h1 className="font-poppins text-2xl font-bold text-dark-gray">{t('feedback.notFoundTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('feedback.notFoundBody')}</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link href="/courses" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#E05530]">
            {t('feedback.findCourse')}
          </Link>
          <Link href="/" className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-cream">
            {t('feedback.goHome')}
          </Link>
        </div>
      </div>
    </main>
  )
}
