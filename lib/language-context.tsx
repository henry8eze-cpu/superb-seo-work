'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { translations } from './translations'
import {
  interpolate,
  isAuthoredLocale,
  lookup,
  LOCALE_COOKIE,
  messages,
  OVERLAYS,
  textDirection,
  type Locale,
  type TranslateVars,
} from './i18n'

export type Language = Locale

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, vars?: TranslateVars) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children, initialLanguage = 'de' }: { children: ReactNode; initialLanguage?: Language }) {
  const router = useRouter()
  const [language, setLanguageState] = useState<Language>(initialLanguage)

  // Persist the choice so server-rendered pages use it too, then re-render them.
  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    document.cookie = `${LOCALE_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = lang
    document.documentElement.dir = textDirection(lang)
    router.refresh()
  }

  const t = (key: string, vars?: TranslateVars): string => {
    // Turkish, Ukrainian and Arabic come from their own files first.
    if (!isAuthoredLocale(language)) {
      const own = OVERLAYS[language]?.[key]
      if (own !== undefined) return interpolate(own, vars)
    }

    // Legacy translations exist in German and English only.
    let value: any = translations[isAuthoredLocale(language) ? language : 'en']
    for (const k of key.split('.')) {
      value = value?.[k]
    }

    if (typeof value === 'string') return interpolate(value, vars)
    // Legacy landing translations also hold lists (e.g. pricing features).
    if (Array.isArray(value)) return value as unknown as string
    return interpolate(lookup(messages, key, language) ?? key, vars)
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
