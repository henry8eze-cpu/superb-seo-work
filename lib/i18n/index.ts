import { createTranslator, isLocale, DEFAULT_LOCALE } from './core'
import { messages } from './messages'

export * from './core'
export { messages }
export { OVERLAYS } from './locales'

/** Translator for a fixed locale, e.g. when rendering an email in the recipient's language. */
export function getTFor(locale: string | null | undefined) {
  return createTranslator(messages, isLocale(locale) ? locale : DEFAULT_LOCALE)
}
