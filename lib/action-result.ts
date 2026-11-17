import 'server-only'
import { ZodError } from 'zod'
import { isAppError } from './errors'
import { getT } from './i18n/server'
import { parseMoneyToCents } from './money'

export type ActionResult<T = unknown> = { success: true; data?: T; message?: string } | { success: false; error: string; code?: string }

/**
 * Runs a service call for a server action and turns failures into a translated
 * message. Unexpected errors are logged and reported generically.
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { success: true, data: await fn() }
  } catch (error) {
    // Let Next.js redirects/not-found propagate.
    if (error && typeof error === 'object' && 'digest' in error && String((error as { digest: unknown }).digest).startsWith('NEXT_')) {
      throw error
    }
    const { t } = await getT()
    if (isAppError(error)) {
      const detail = error.message && error.message !== error.code && error.code !== 'NO_SEATS' ? error.message : ''
      return { success: false, code: error.code, error: [t(`errors.${error.code}`), detail].filter(Boolean).join(' – ') }
    }
    if (error instanceof ZodError) {
      const fields = [...new Set(error.issues.map((i) => i.path.join('.')).filter(Boolean))]
      return { success: false, code: 'VALIDATION', error: t('errors.VALIDATION_FIELDS', { fields: fields.join(', ') || '–' }) }
    }
    console.error('[action] unexpected error', error)
    return { success: false, code: 'UNKNOWN', error: t('errors.UNKNOWN') }
  }
}

// FormData helpers ----------------------------------------------------------

export function str(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export function optStr(form: FormData, key: string) {
  return str(form, key) || undefined
}

export function bool(form: FormData, key: string) {
  const value = form.get(key)
  return value === 'on' || value === 'true' || value === '1'
}

export function ints(form: FormData, key: string) {
  return form
    .getAll(key)
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n))
}

export function strings(form: FormData, key: string) {
  return form
    .getAll(key)
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
}

export function cents(form: FormData, key: string) {
  const value = str(form, key)
  if (!value) return undefined
  try {
    return parseMoneyToCents(value)
  } catch {
    return Number.NaN
  }
}

export function num(form: FormData, key: string) {
  const value = str(form, key)
  return value === '' ? undefined : Number(value)
}
