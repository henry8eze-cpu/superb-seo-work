import { TIME_ZONE } from './config'

import { intlLocale } from './i18n/core'

export function formatDate(date: Date | string | null | undefined, locale = 'de') {
  if (!date) return '–'
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string | null | undefined, locale = 'de') {
  if (!date) return '–'
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date(date))
}

export function formatTime(date: Date | string, locale = 'de') {
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE }).format(new Date(date))
}

/** Calendar-date fields (@db.Date) are stored at UTC midnight; format them without shifting days. */
export function formatDay(date: Date | string | null | undefined, locale = 'de') {
  if (!date) return '–'
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date))
}

/** "2026-11-02" → Date at UTC midnight, for @db.Date columns. */
export function parseDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date: ${value}`)
  return new Date(`${value}T00:00:00.000Z`)
}

export function toDayInput(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : ''
}

/** Value for <input type="datetime-local"> in Berlin time. */
export function toDateTimeInput(date: Date | null | undefined) {
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  return parts.replace(' ', 'T')
}

/** Parses a datetime-local value entered in Berlin time into a UTC Date. */
export function parseBerlinDateTime(value: string): Date {
  const [day, time = '00:00'] = value.split('T')
  const asUtc = new Date(`${day}T${time}:00.000Z`)
  // Find Berlin's offset at that moment and correct for it.
  const berlin = new Date(asUtc.toLocaleString('en-US', { timeZone: TIME_ZONE }))
  const utc = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(asUtc.getTime() - (berlin.getTime() - utc.getTime()))
}

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

export function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}
