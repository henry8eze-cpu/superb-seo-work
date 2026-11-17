import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSchoolActor } from '@/lib/session'
import { bookingWhere, readBookingFilters } from '@/lib/booking/filters'
import { paymentSummary } from '@/lib/booking/manage'
import { toCsv } from '@/lib/csv'

export async function GET(request: NextRequest) {
  const actor = await getSchoolActor()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const filters = { ...readBookingFilters(Object.fromEntries(request.nextUrl.searchParams)), schoolId: actor.schoolId, cityId: undefined }
  const bookings = await prisma.booking.findMany({
    where: { AND: [bookingWhere(filters), { schoolId: actor.schoolId }] },
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: {
      payments: { include: { refunds: true } },
      intake: { select: { startDate: true, courseType: { select: { name: true, branch: { select: { name: true } } } } } },
    },
  })

  const csv = toCsv(
    ['Reference', 'Status', 'Channel', 'Course', 'Branch', 'Start', 'Name', 'Email', 'Phone', 'Total (EUR)', 'Paid (EUR)', 'Outstanding (EUR)', 'Created'],
    bookings.map((b) => {
      const { paid, outstanding } = paymentSummary(b)
      return [
        b.reference,
        b.status,
        b.channel,
        b.intake.courseType.name,
        b.intake.courseType.branch.name,
        b.intake.startDate.toISOString().slice(0, 10),
        b.studentName,
        b.studentEmail,
        b.studentPhone ?? '',
        (b.totalCents / 100).toFixed(2),
        (paid / 100).toFixed(2),
        (outstanding / 100).toFixed(2),
        b.createdAt.toISOString(),
      ]
    })
  )
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"` },
  })
}
