'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/** Counts down the seat hold; refreshes the page when it runs out so the server shows the real state. */
export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter()
  const [left, setLeft] = useState(() => new Date(expiresAt).getTime() - Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = new Date(expiresAt).getTime() - Date.now()
      setLeft(remaining)
      if (remaining <= 0) {
        clearInterval(timer)
        router.refresh()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [expiresAt, router])

  const seconds = Math.max(0, Math.floor(left / 1000))
  return (
    <span className={`font-mono font-bold ${seconds < 120 ? 'text-red-600' : 'text-dark-gray'}`}>
      {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
    </span>
  )
}

/** Re-checks the booking every couple of seconds while the payment confirmation is on its way. */
export function AutoRefresh({ everyMs = 2000, maxTries = 45 }: { everyMs?: number; maxTries?: number }) {
  const router = useRouter()
  useEffect(() => {
    let tries = 0
    const timer = setInterval(() => {
      tries++
      router.refresh()
      if (tries >= maxTries) clearInterval(timer)
    }, everyMs)
    return () => clearInterval(timer)
  }, [router, everyMs, maxTries])
  return null
}
