import { requireAdmin } from '@/app/actions/auth'
import { getRegistration } from '@/app/actions/registrations'
import { RegistrationStatusActions } from '@/components/admin/registration-status-actions'
import { RegistrationNotes } from '@/components/admin/registration-notes'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, Phone, Globe, BookOpen } from 'lucide-react'

export const metadata = {
  title: 'Application Details | Admin Dashboard',
}

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const registration = await getRegistration(id)

  if (!registration) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Registrations
      </Link>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-dark-gray mb-1">
            {registration.fullName}
          </h2>
          <p className="text-muted-foreground">
            Submitted{' '}
            {registration.createdAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        <RegistrationStatusActions registrationId={registration.id} status={registration.status} />
      </div>

      {/* Application Details */}
      <div className="bg-white rounded-lg shadow-soft p-6 grid md:grid-cols-2 gap-6">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground mb-1">Email</p>
            <p className="font-medium text-dark-gray">{registration.email}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Phone className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground mb-1">Phone</p>
            <p className="font-medium text-dark-gray">{registration.phone}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground mb-1">Country</p>
            <p className="font-medium text-dark-gray">{registration.country || 'Not provided'}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground mb-1">Preferred Course / Level</p>
            <p className="font-medium text-dark-gray">
              {registration.preferredCourse || 'Not specified'}
            </p>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">German Level</p>
          <p className="font-medium text-dark-gray">{registration.germanLevel || 'Not specified'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Learning Mode</p>
          <p className="font-medium text-dark-gray">{registration.learningMode || 'Not specified'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Preferred Class Time</p>
          <p className="font-medium text-dark-gray">
            {registration.preferredClassTime || 'Not specified'}
          </p>
        </div>
        {registration.additionalMessage && (
          <div className="md:col-span-2">
            <p className="text-sm text-muted-foreground mb-1">Additional Message</p>
            <p className="text-dark-gray whitespace-pre-wrap">{registration.additionalMessage}</p>
          </div>
        )}
      </div>

      <RegistrationNotes registrationId={registration.id} notes={registration.adminNotes} />
    </div>
  )
}
