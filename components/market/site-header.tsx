import Image from 'next/image'
import Link from 'next/link'
import { getActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { PLATFORM_NAME } from '@/lib/config'
import { prisma } from '@/lib/prisma'
import { LanguageSwitcher } from '@/components/language-switcher'
import { logoutUser } from '@/app/actions/auth'

async function logoutAndGoHome() {
  'use server'
  await logoutUser()
  const { redirect } = await import('next/navigation')
  redirect('/')
}

export async function SiteHeader() {
  const [{ t }, actor] = await Promise.all([getT(), getActor()])
  const isSchoolUser = actor ? (await prisma.schoolMembership.count({ where: { userId: actor.userId, status: 'ACTIVE' } })) > 0 : false

  return (
    <header className="bg-white/95 backdrop-blur border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="" width={36} height={36} className="w-9 h-9" />
          <span className="font-poppins font-bold text-lg text-dark-gray hidden sm:inline">{PLATFORM_NAME}</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5 text-sm font-medium">
          <Link href="/courses" className="text-dark-gray hover:text-primary whitespace-nowrap">
            {t('market.nav.findCourse')}
          </Link>
          <Link href="/schools" className="text-dark-gray hover:text-primary hidden sm:inline">
            {t('market.nav.schools')}
          </Link>
          {actor ? (
            <>
              {actor.role === 'PLATFORM_ADMIN' && (
                <Link href="/admin" className="text-dark-gray hover:text-primary hidden sm:inline">
                  {t('market.nav.admin')}
                </Link>
              )}
              {isSchoolUser && (
                <Link href="/school" className="text-dark-gray hover:text-primary hidden sm:inline">
                  {t('market.nav.schoolApp')}
                </Link>
              )}
              <Link href="/account" className="text-dark-gray hover:text-primary">
                {t('market.nav.myBookings')}
              </Link>
              <form action={logoutAndGoHome} className="hidden sm:block">
                <button className="text-muted-foreground hover:text-red-600">{t('common.logout')}</button>
              </form>
            </>
          ) : (
            <Link href="/auth/login" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-[#E05530] whitespace-nowrap">
              {t('common.login')}
            </Link>
          )}
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  )
}

export async function SiteFooter() {
  const { t } = await getT()
  return (
    <footer className="border-t border-border bg-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-sm text-muted-foreground flex flex-col sm:flex-row justify-between gap-4">
        <p>
          © {new Date().getFullYear()} {PLATFORM_NAME} · {t('common.platformTagline')}
        </p>
        <p>{t('market.footer.forSchools')}</p>
      </div>
    </footer>
  )
}
