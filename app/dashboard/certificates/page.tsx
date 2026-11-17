import { requireAuth } from '@/app/actions/auth'
import { prisma } from '@/lib/prisma'
import { Award, Download } from 'lucide-react'

export const metadata = {
  title: 'Certificates | Dashboard',
}

export default async function CertificatesPage() {
  const user = await requireAuth()

  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    include: {
      certificates: {
        include: {
          course: true,
        },
      },
    },
  })

  const certificates = student?.certificates ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-dark-gray mb-2">
          Your Certificates
        </h2>
        <p className="text-muted-foreground">
          View and download your earned certificates
        </p>
      </div>

      {certificates.length > 0 ? (
        <div className="space-y-4">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="bg-white rounded-lg shadow-soft p-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="bg-secondary bg-opacity-10 p-4 rounded-lg">
                  <Award className="w-8 h-8 text-secondary" />
                </div>
                <div>
                  <h3 className="font-poppins font-semibold text-dark-gray mb-1">
                    {cert.course.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Certificate #{cert.certificateNumber}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Issued:{' '}
                    {cert.issueDate.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <button className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-all flex items-center gap-2 font-medium">
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-soft p-12 text-center">
          <Award className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
          <h3 className="font-poppins text-xl font-bold text-dark-gray mb-2">
            No Certificates Yet
          </h3>
          <p className="text-muted-foreground">
            Complete a course to earn your certificate!
          </p>
        </div>
      )}
    </div>
  )
}
