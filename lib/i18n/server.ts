import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { createTranslator, isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from './core'
import { messages } from './messages'

export const getLocale = cache(async (): Promise<Locale> => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(cookieLocale)) return cookieLocale
  return negotiateLocale((await headers()).get('accept-language'))
})

export async function getT() {
  const locale = await getLocale()
  return { t: createTranslator(messages, locale), locale }
}
