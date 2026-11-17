'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LogOut,
  BarChart3,
  Users,
  GraduationCap,
  BookOpen,
  Settings,
  Map,
  School,
  Upload,
  Copy,
  BadgeCheck,
  ClipboardCheck,
  Clock,
  Ticket,
  LifeBuoy,
  History,
} from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { LanguageSwitcher } from '@/components/language-switcher'

const linkDefs = [
  { key: 'overview', href: '/admin', icon: BarChart3 },
  { key: 'cities', href: '/admin/cities', icon: Map },
  { key: 'schools', href: '/admin/schools', icon: School },
  { key: 'import', href: '/admin/import', icon: Upload },
  { key: 'duplicates', href: '/admin/duplicates', icon: Copy },
  { key: 'claims', href: '/admin/claims', icon: BadgeCheck },
  { key: 'approvals', href: '/admin/approvals', icon: ClipboardCheck },
  { key: 'stale', href: '/admin/stale', icon: Clock },
  { key: 'bookings', href: '/admin/bookings', icon: Ticket },
  { key: 'support', href: '/admin/support', icon: LifeBuoy },
  { key: 'audit', href: '/admin/audit', icon: History },
  { key: 'registrations', href: '/admin/registrations', icon: Users, legacy: true },
  { key: 'students', href: '/admin/students', icon: GraduationCap, legacy: true },
  { key: 'courses', href: '/admin/courses', icon: BookOpen, legacy: true },
  { key: 'settings', href: '/admin/settings', icon: Settings, legacy: true },
]

export function AdminShell({
  user,
  logoutAction,
  children,
}: {
  user: { name: string; email: string }
  logoutAction: () => Promise<void>
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const adminLinks = linkDefs.map((link) => ({ ...link, name: t(`admin.nav.${link.key}`) }))

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const currentLink =
    adminLinks.slice().sort((a, b) => b.href.length - a.href.length).find((link) => isActive(link.href)) ??
    adminLinks[0]

  return (
    // The admin console is written in German and English only, so it always reads left to right.
    <div dir="ltr" className="flex h-screen bg-cream">

      {/* Desktop Sidebar — always rendered; collapses to icons-only below lg instead of disappearing */}
      <aside className="hidden sm:flex w-16 lg:w-64 bg-dark-gray text-white flex-col shrink-0">
        <div className="p-4 lg:p-6 border-b border-white/10 flex items-center gap-3">
          <span className="shrink-0 w-9 h-9 rounded-lg bg-cream flex items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
          </span>
          <div className="hidden lg:block">
            <h2 className="font-poppins font-bold text-lg leading-tight">Superb</h2>
            <p className="text-xs text-white/50">{t('admin.console')}</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2 lg:px-4 space-y-1 overflow-y-auto">
          {adminLinks.map((link, index) => {
            const Icon = link.icon
            const active = isActive(link.href)
            const firstLegacy = link.legacy && !adminLinks[index - 1]?.legacy
            return (
              <div key={link.key}>
              {firstLegacy && (
                <p className="hidden lg:block px-4 pt-4 pb-1 text-[11px] uppercase tracking-wide text-white/40">{t('admin.nav.legacy')}</p>
              )}
              <Link
                href={link.href}
                title={link.name}
                className={`flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="hidden lg:inline">{link.name}</span>
              </Link>
              </div>
            )
          })}
        </nav>

        <div className="p-2 lg:p-4 border-t border-white/10">
          <form action={logoutAction}>
            <button
              type="submit"
              title="Logout"
              className="w-full flex items-center justify-center lg:justify-start gap-2 px-2 lg:px-4 py-3 text-red-400 hover:bg-red-900/20 rounded-lg font-medium transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">{t('common.logout')}</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-border px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <h1 className="font-poppins text-lg md:text-xl font-bold text-dark-gray truncate">
            {currentLink.name}
          </h1>

          <div className="flex items-center gap-3 shrink-0">
            <LanguageSwitcher />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-dark-gray">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-poppins font-bold text-sm shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <form action={logoutAction} className="sm:hidden">
              <button
                type="submit"
                aria-label="Logout"
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </form>
          </div>
        </header>

        {/* Quick Nav — always visible below sm, no menu to discover */}
        <nav className="sm:hidden flex items-center gap-2 overflow-x-auto px-4 py-2 bg-white border-b border-border">
          {adminLinks.map((link) => {
            const Icon = link.icon
            const active = isActive(link.href)
            return (
              <Link
                key={link.key}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'bg-cream text-dark-gray hover:bg-dark-gray/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.name}
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
