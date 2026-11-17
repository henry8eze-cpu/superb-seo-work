// Translation core shared by server and client code.
//
// German and English are authored side by side in the message tree, e.g.
//   { save: { en: 'Save', de: 'Speichern' } }
// so a missing German or English text is a type error.
//
// Further languages are flat key → text files in ./locales (one file per
// language, easy to hand to a translator). Anything missing there falls back to
// English, and a unit test checks every file is complete.

import { OVERLAYS } from './locales'

export const AUTHORED_LOCALES = ['de', 'en'] as const
export type AuthoredLocale = (typeof AUTHORED_LOCALES)[number]

export const LOCALES = ['de', 'en', 'tr', 'uk', 'ar'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'de'
export const LOCALE_COOKIE = 'locale'

/** Display name, writing direction and Intl locale for each language. */
export const LOCALE_META: Record<Locale, { nativeName: string; dir: 'ltr' | 'rtl'; intl: string }> = {
  de: { nativeName: 'Deutsch', dir: 'ltr', intl: 'de-DE' },
  en: { nativeName: 'English', dir: 'ltr', intl: 'en-GB' },
  tr: { nativeName: 'Türkçe', dir: 'ltr', intl: 'tr-TR' },
  uk: { nativeName: 'Українська', dir: 'ltr', intl: 'uk-UA' },
  // Latin digits keep prices, dates and postcodes in the same form as elsewhere in Germany.
  ar: { nativeName: 'العربية', dir: 'rtl', intl: 'ar-u-nu-latn' },
}

export type Message = Record<AuthoredLocale, string>
export type MessageTree = { [key: string]: Message | MessageTree }

export type TranslateVars = Record<string, string | number | null | undefined>
export type Translate = (key: string, vars?: TranslateVars) => string

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function isAuthoredLocale(value: Locale): value is AuthoredLocale {
  return (AUTHORED_LOCALES as readonly string[]).includes(value)
}

/** The Intl locale for formatting dates, numbers and money. */
export function intlLocale(locale: string | null | undefined) {
  return isLocale(locale) ? LOCALE_META[locale].intl : LOCALE_META[DEFAULT_LOCALE].intl
}

/** Name of a taught language (from the languages table) in the reader's language. */
export function languageName(lang: { code: string; nameEn: string; nameDe: string }, locale: string | null | undefined) {
  if (locale === 'de') return lang.nameDe
  if (locale === 'en' || !isLocale(locale)) return lang.nameEn
  try {
    const name = new Intl.DisplayNames([LOCALE_META[locale].intl], { type: 'language' }).of(lang.code)
    if (name && name !== lang.code) return name.charAt(0).toLocaleUpperCase(LOCALE_META[locale].intl) + name.slice(1)
  } catch {}
  return lang.nameEn
}

export function textDirection(locale: string | null | undefined) {
  return isLocale(locale) ? LOCALE_META[locale].dir : 'ltr'
}

function isMessage(node: unknown): node is Message {
  return !!node && typeof node === 'object' && AUTHORED_LOCALES.every((l) => typeof (node as any)[l] === 'string')
}

export function interpolate(template: string, vars?: TranslateVars) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] === undefined || vars[name] === null ? match : String(vars[name])
  )
}

/** Text for a key in a language: authored languages from the tree, others from their file, then English. */
export function lookup(tree: MessageTree, key: string, locale: Locale): string | undefined {
  if (!isAuthoredLocale(locale)) {
    const overlay = OVERLAYS[locale]?.[key]
    if (overlay !== undefined) return overlay
    return lookup(tree, key, 'en')
  }
  let node: unknown = tree
  for (const part of key.split('.')) {
    node = (node as any)?.[part]
    if (node === undefined) return undefined
  }
  return isMessage(node) ? node[locale] : undefined
}

export function createTranslator(tree: MessageTree, locale: Locale): Translate {
  return (key, vars) => interpolate(lookup(tree, key, locale) ?? key, vars)
}

/** Picks the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE
  const preferred = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=')
      return { lang: tag.toLowerCase().split('-')[0], q: q ? Number(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)
  return preferred.map((p) => p.lang).find(isLocale) ?? DEFAULT_LOCALE
}

/** Every message key in a tree, flattened ("market.course.price"). */
export function messageKeys(tree: MessageTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, node]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return isMessage(node) ? [key] : messageKeys(node as MessageTree, key)
  })
}
