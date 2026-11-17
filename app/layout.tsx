import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Poppins, Inter, Noto_Sans_Arabic } from 'next/font/google'
import { LanguageProvider } from '@/lib/language-context'
import { getLocale } from '@/lib/i18n/server'
import { textDirection } from '@/lib/i18n'
import { Suspense } from 'react'
import { Toaster } from 'sonner'
import { FlashToast } from '@/components/app/flash-toast'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
})

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
})

// Only used on Arabic pages. No metric-adjusted fallback, so Latin words fall through to Inter.
const arabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  preload: false,
  adjustFontFallback: false,
})

export const metadata: Metadata = {
  title: 'Superb – Sprachkurse in NRW finden und sofort buchen',
  description: 'Find German courses in NRW with confirmed start dates, transparent prices and available places, and book instantly.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2643A' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  return (
    <html lang={locale} dir={textDirection(locale)} className={`${poppins.variable} ${inter.variable} ${arabic.variable}`}>
      <body className="antialiased font-inter bg-cream">
        <LanguageProvider initialLanguage={locale}>
          {children}
          {/* One toast container for the whole app, plus toasts queued before a redirect. */}
          <Toaster position="top-right" richColors closeButton />
          <Suspense>
            <FlashToast />
          </Suspense>
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </LanguageProvider>
      </body>
    </html>
  )
}
