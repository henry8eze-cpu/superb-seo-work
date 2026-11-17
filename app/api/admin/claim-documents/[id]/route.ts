import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActor } from '@/lib/session'

// Proof-of-authority documents are only ever visible to platform admins.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (actor?.role !== 'PLATFORM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const doc = await prisma.claimDocument.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(Buffer.from(doc.data), {
    headers: {
      'Content-Type': doc.mimeType,
      'Content-Disposition': `inline; filename="${doc.fileName.replace(/[^\w.\- ]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
