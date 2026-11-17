import { NextRequest, NextResponse } from 'next/server'
import { getActor } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { bookingWhere, readBookingFilters } from '@/lib/booking/filters'
import { toCsv } from '@/lib/csv'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (actor?.role !== 'PLATFORM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const filters = readBookingFilters(Object.fromEntries(request.nextUrl.searchParams))
  const bookings = await prisma.booking.findMany({
    where: bookingWhere(filters),
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: {
      school: { select: { name: true } },
      payments: { include: { refunds: true } },
      intake: { select: { startDate: true, courseType: { select: { name: true, branch: { select: { cityName: true } } } } } },
    },
  })

  const csv = toCsv(
    ['Reference', 'Status', 'Channel', 'School', 'City', 'Course', 'Start', 'Student', 'Email', 'Total (EUR)', 'Commission (EUR)', 'To school (EUR)', 'Paid (EUR)', 'Refunded (EUR)', 'Created', 'Confirmed'],
    bookings.map((b) => {
      const paid = b.payments.filter((p) => p.status !== 'FAILED').reduce((s, p) => s + p.amountCents, 0)
      const refunded = b.payments.flatMap((p) => p.refunds).filter((r) => r.status === 'SUCCEEDED').reduce((s, r) => s + r.amountCents, 0)
      return [
        b.reference,
        b.status,
        b.channel,
        b.school.name,
        b.intake.courseType.branch.cityName ?? 'Online',
        b.intake.courseType.name,
        b.intake.startDate.toISOString().slice(0, 10),
        b.studentName,
        b.studentEmail,
        (b.totalCents / 100).toFixed(2),
        (b.commissionCents / 100).toFixed(2),
        ((b.totalCents - b.commissionCents) / 100).toFixed(2),
        (paid / 100).toFixed(2),
        (refunded / 100).toFixed(2),
        b.createdAt.toISOString(),
        b.confirmedAt?.toISOString() ?? '',
      ]
    })
  )

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
