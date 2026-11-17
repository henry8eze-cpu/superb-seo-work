import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { expireStaleHolds, retryPendingRefunds } from '@/lib/booking/inventory'
import { invalidatePublicCatalog } from '@/lib/public-cache'

// Scheduled job (see vercel.json): expires lapsed seat holds and retries failed refunds.
// Holds are also ignored as soon as they lapse, so seat counts never depend on this running.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const expired = await expireStaleHolds()
  const refunds = await retryPendingRefunds()
  if (expired > 0) {
    revalidatePath('/courses', 'layout')
    invalidatePublicCatalog()
  }
  return NextResponse.json({ expired, refundsRetried: refunds })
}
