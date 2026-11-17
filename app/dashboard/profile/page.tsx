import { requireAuth } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { User } from 'lucide-react'

export const metadata = {
  title: 'Profile | Dashboard',
}

export default async function ProfilePage() {
  const user = await requireAuth()

  const student = await prisma.student.findUnique({
    where: { userId: user.id },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-dark-gray mb-2">
          My Profile
        </h2>
        <p className="text-muted-foreground">
          Manage your account information and preferences
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-soft p-8">
        <div className="flex items-start gap-6 mb-8">
          <div className="bg-gradient-to-br from-primary to-secondary p-4 rounded-lg">
            <User className="w-12 h-12 text-white" />
          </div>
          <div>
            <h3 className="font-poppins text-2xl font-bold text-dark-gray">
              {user.name}
            </h3>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              German Level
            </label>
            <select className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white">
              <option value="">Select level</option>
              <option value="A1">A1 - Beginner</option>
              <option value="A2">A2 - Elementary</option>
              <option value="B1">B1 - Intermediate</option>
              <option value="B2">B2 - Upper Intermediate</option>
              <option value="C1">C1 - Advanced</option>
              <option value="C2">C2 - Mastery</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Learning Mode
            </label>
            <select className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white">
              <option value="">Select mode</option>
              <option value="ONLINE">Online</option>
              <option value="INPERSON">In-Person</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Phone
            </label>
            <input
              type="tel"
              placeholder="Your phone number"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              defaultValue={student?.phone || ''}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Country
            </label>
            <input
              type="text"
              placeholder="Your country"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              defaultValue={student?.country || ''}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Preferred Class Time
            </label>
            <select className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white">
              <option value="">Select time</option>
              <option value="morning">Morning (8am-12pm)</option>
              <option value="afternoon">Afternoon (1pm-5pm)</option>
              <option value="evening">Evening (6pm-9pm)</option>
              <option value="weekend">Weekend</option>
            </select>
          </div>
        </div>

        <button className="bg-primary text-white font-medium py-3 px-8 rounded-lg hover:bg-opacity-90 transition-all">
          Save Changes
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-soft p-8">
        <h3 className="font-poppins text-lg font-bold text-dark-gray mb-4">
          Account Settings
        </h3>
        <button className="text-red-600 font-medium hover:text-red-700">
          Change Password
        </button>
      </div>
    </div>
  )
}
