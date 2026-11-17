import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSchoolActor } from '@/lib/session'
import { paymentSummary } from '@/lib/booking/manage'
import { toCsv } from '@/lib/csv'

// Student list for one intake. Scoped to the signed-in user's school.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getSchoolActor()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const intake = await prisma.intake.findUnique({
    where: { id },
    include: {
      courseType: { select: { name: true } },
      bookings: { where: { status: 'CONFIRMED' }, orderBy: { studentName: 'asc' }, include: { payments: { include: { refunds: true } } } },
    },
  })
  if (!intake || intake.schoolId !== actor.schoolId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const csv = toCsv(
    ['Reference', 'Name', 'Email', 'Phone', 'Channel', 'Total (EUR)', 'Paid (EUR)', 'Outstanding (EUR)', 'Confirmed', 'Notes'],
    intake.bookings.map((b) => {
      const { paid, outstanding } = paymentSummary(b)
      return [
        b.reference,
        b.studentName,
        b.studentEmail,
        b.studentPhone ?? '',
        b.channel,
        (b.totalCents / 100).toFixed(2),
        (paid / 100).toFixed(2),
        (outstanding / 100).toFixed(2),
        b.confirmedAt?.toISOString().slice(0, 10) ?? '',
        b.notes ?? '',
      ]
    })
  )
  const name = `${intake.courseType.name}-${intake.startDate.toISOString().slice(0, 10)}`.replace(/[^\w.-]+/g, '_')
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"` },
  })
}
