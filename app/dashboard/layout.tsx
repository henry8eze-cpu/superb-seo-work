import { adminLogout, requireAuth } from '@/app/actions/auth'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Dashboard | Superb Sprachschule',
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  if (user.role === 'PLATFORM_ADMIN') {
    redirect('/admin')
  }

  return (
    <div className="flex h-screen bg-cream">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-e border-border flex-col">
        <div className="p-6 border-b border-border">
          <h2 className="font-poppins font-bold text-xl text-dark-gray">
            Superb
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Student Dashboard</p>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2">
          <Link
            href="/dashboard"
            className="block px-4 py-3 rounded-lg text-dark-gray hover:bg-cream font-medium transition-colors"
          >
            Overview
          </Link>
          <Link
            href="/dashboard/courses"
            className="block px-4 py-3 rounded-lg text-dark-gray hover:bg-cream font-medium transition-colors"
          >
            My Courses
          </Link>
          <Link
            href="/dashboard/certificates"
            className="block px-4 py-3 rounded-lg text-dark-gray hover:bg-cream font-medium transition-colors"
          >
            Certificates
          </Link>
          <Link
            href="/dashboard/profile"
            className="block px-4 py-3 rounded-lg text-dark-gray hover:bg-cream font-medium transition-colors"
          >
            Profile
          </Link>
        </nav>

        <div className="p-4 border-t border-border">
          <form action={adminLogout}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-8">
          <div className="mb-8">
            <h1 className="font-poppins text-3xl font-bold text-dark-gray mb-2">
              Welcome, {user.name}!
            </h1>
            <p className="text-muted-foreground">
              Manage your courses and learning progress
            </p>
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}
