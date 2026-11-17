import 'server-only'
import { cookies } from 'next/headers'

export const FLASH_COOKIE = 'flash'

export type FlashKind = 'success' | 'error' | 'info'

/**
 * Queues a toast to show on the next page the browser renders — for actions that
 * redirect (log out, release a seat, accept an invitation). `key` is a
 * translation key under `feedback.*`. Only callable from server actions / route handlers.
 */
export async function setFlash(kind: FlashKind, key: string, vars?: Record<string, string | number>) {
  ;(await cookies()).set(FLASH_COOKIE, Buffer.from(JSON.stringify({ kind, key, vars })).toString('base64url'), {
    path: '/',
    maxAge: 60,
    sameSite: 'lax',
    httpOnly: false, // read and cleared by the client toast component
  })
}
