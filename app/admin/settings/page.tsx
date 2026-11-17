import { requireAdmin } from '@/app/actions/auth'
import { getSettings } from '@/app/actions/settings'
import { SettingsForm } from '@/components/forms/settings-form'
import { ChangePasswordForm } from '@/components/forms/change-password-form'

export const metadata = {
  title: 'Settings | Admin Dashboard',
}

export default async function SettingsPage() {
  const admin = await requireAdmin()
  const settings = await getSettings()

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-dark-gray mb-2">
          Settings
        </h2>
        <p className="text-muted-foreground">
          Manage system settings and preferences
        </p>
      </div>

      <SettingsForm settings={settings} />

      {/* Admin Profile */}
      <div className="bg-white rounded-lg shadow-soft p-8">
        <h3 className="font-poppins text-lg font-bold text-dark-gray mb-6">
          Admin Profile
        </h3>
        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Name</p>
            <p className="font-medium text-dark-gray">{admin.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Email</p>
            <p className="font-medium text-dark-gray">{admin.email}</p>
          </div>
        </div>

        <h4 className="font-poppins font-bold text-dark-gray mb-4">Change Password</h4>
        <ChangePasswordForm />
      </div>
    </div>
  )
}
