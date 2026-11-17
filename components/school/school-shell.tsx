'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LogOut, LayoutDashboard, Users, BookOpen, MapPin, MessageSquare, UserCog, Receipt, Store } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { LanguageSwitcher } from '@/components/language-switcher'

const linkDefs = [
  { key: 'dashboard', href: '/school', icon: LayoutDashboard },
  { key: 'bookings', href: '/school/bookings', icon: Users, badge: 'cancellations' as const },
  { key: 'courses', href: '/school/courses', icon: BookOpen },
  { key: 'branches', href: '/school/branches', icon: MapPin },
  { key: 'enquiries', href: '/school/enquiries', icon: MessageSquare, badge: 'enquiries' as const },
  { key: 'team', href: '/school/team', icon: UserCog },
  { key: 'finance', href: '/school/finance', icon: Receipt },
  { key: 'profile', href: '/school/profile', icon: Store },
]

export function SchoolShell({
  user,
  school,
  schools,
  supportMode,
  counts,
  logoutAction,
  switchAction,
  leaveSupportAction,
  children,
}: {
  user: { name: string; email: string }
  school: { id: string; name: string }
  schools: { id: string; name: string }[]
  supportMode: boolean
  counts: { enquiries: number; cancellations: number }
  logoutAction: () => Promise<void>
  switchAction: (form: FormData) => Promise<void>
  leaveSupportAction: () => Promise<void>
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const links = linkDefs.map((l) => ({ ...l, name: t(`school.nav.${l.key}`), count: l.badge ? counts[l.badge] : 0 }))
  // Intake pages live under /school/intakes but belong to "Courses & intakes".
  const section = pathname.startsWith('/school/intakes') ? '/school/courses' : pathname
  const isActive = (href: string) => (href === '/school' ? section === '/school' : section === href || section.startsWith(`${href}/`))
  const current = links.find((l) => isActive(l.href)) ?? links[0]

  return (
    <div className="flex h-screen bg-cream">
      <aside className="hidden sm:flex w-16 lg:w-64 bg-dark-gray text-white flex-col shrink-0">
        <div className="p-4 lg:p-6 border-b border-white/10 flex items-center gap-3">
          <span className="shrink-0 w-9 h-9 rounded-lg bg-cream flex items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
          </span>
          <div className="hidden lg:block min-w-0">
            <h2 className="font-poppins font-bold text-base leading-tight truncate">{school.name}</h2>
            <p className="text-xs text-white/50">{t('school.app')}</p>
          </div>
        </div>
        <nav className="flex-1 py-4 px-2 lg:px-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon
            const active = isActive(link.href)
            return (
              <Link
                key={link.key}
                href={link.href}
                title={link.name}
                className={`relative flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-primary text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="hidden lg:inline flex-1">{link.name}</span>
                {link.count > 0 && (
                  <span className="absolute top-1 end-1 lg:static bg-secondary text-dark-gray text-[10px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                    {link.count}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
        <div className="p-2 lg:p-4 border-t border-white/10">
          <form action={logoutAction}>
            <button type="submit" title={t('common.logout')} className="w-full flex items-center justify-center lg:justify-start gap-2 px-2 lg:px-4 py-3 text-red-400 hover:bg-red-900/20 rounded-lg font-medium transition-colors">
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">{t('common.logout')}</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {supportMode && (
          <div className="bg-secondary text-dark-gray text-sm px-4 py-2 flex items-center justify-between gap-3">
            <span>{t('school.supportMode', { school: school.name })}</span>
            <form action={leaveSupportAction}>
              <button className="underline font-medium">{t('school.leaveSupport')}</button>
            </form>
          </div>
        )}
        <header className="bg-white border-b border-border px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <h1 className="font-poppins text-lg md:text-xl font-bold text-dark-gray truncate">{current.name}</h1>
          <div className="flex items-center gap-3 shrink-0">
            {schools.length > 1 && (
              <form action={switchAction} className="hidden md:block">
                <select
                  name="schoolId"
                  defaultValue={school.id}
                  aria-label={t('school.switchSchool')}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  className="text-sm border border-border rounded-lg px-2 py-1 bg-white"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </form>
            )}
            <LanguageSwitcher />
            <div className="text-end hidden md:block">
              <p className="text-sm font-medium text-dark-gray">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <form action={logoutAction} className="sm:hidden">
              <button type="submit" aria-label={t('common.logout')} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                <LogOut className="w-5 h-5" />
              </button>
            </form>
          </div>
        </header>
        <nav className="sm:hidden flex items-center gap-2 overflow-x-auto px-4 py-2 bg-white border-b border-border">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.key}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${isActive(link.href) ? 'bg-primary text-white' : 'bg-cream text-dark-gray'}`}
              >
                <Icon className="w-4 h-4" />
                {link.name}
                {link.count > 0 && <span className="text-xs font-bold">({link.count})</span>}
              </Link>
            )
          })}
        </nav>
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
