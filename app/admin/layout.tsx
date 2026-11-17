import { requireAdmin, adminLogout } from '@/app/actions/auth'
import { AdminShell } from '@/components/admin/admin-shell'

export const metadata = {
  title: 'Admin Dashboard | Superb Sprachschule',
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAdmin()

  return (
    <AdminShell user={{ name: user.name, email: user.email }} logoutAction={adminLogout}>
      {children}
    </AdminShell>
  )
}
