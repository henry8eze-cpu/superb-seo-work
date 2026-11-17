import { prisma } from '@/lib/prisma'
import { getSchoolOptions, requireSchoolActor } from '@/lib/session'
import { adminLogout } from '@/app/actions/auth'
import { leaveSupportModeAction, switchSchoolAction } from '@/app/actions/school'
import { SchoolShell } from '@/components/school/school-shell'

export const metadata = {
  title: 'School app',
}

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireSchoolActor()
  const [school, schools, enquiries, cancellations] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: actor.schoolId }, select: { id: true, name: true } }),
    getSchoolOptions(actor),
    prisma.enquiry.count({ where: { schoolId: actor.schoolId, status: 'NEW' } }),
    prisma.booking.count({ where: { schoolId: actor.schoolId, status: 'CONFIRMED', cancellationRequestedAt: { not: null } } }),
  ])

  return (
    <SchoolShell
      user={{ name: actor.name, email: actor.email }}
      school={school}
      schools={schools}
      supportMode={actor.schoolRole === 'PLATFORM_ADMIN'}
      counts={{ enquiries, cancellations }}
      logoutAction={adminLogout}
      switchAction={switchSchoolAction}
      leaveSupportAction={leaveSupportModeAction}
    >
      {children}
    </SchoolShell>
  )
}
