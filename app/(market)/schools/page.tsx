import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { getDirectoryCitiesCached, getDirectorySchoolsCached } from '@/lib/services/landing'
import { SchoolCards } from '@/components/home/sections'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Sprachschulen in NRW | Language schools in NRW',
  description: 'Language schools and Volkshochschulen in NRW with upcoming German course dates.',
}

export default async function SchoolsPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city } = await searchParams
  const [{ t, locale }, cities, schools] = await Promise.all([
    getT(),
    getDirectoryCitiesCached(),
    getDirectorySchoolsCached(city ?? null, null),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-poppins text-3xl md:text-4xl font-bold text-dark-gray">{t('home.schools.directoryTitle')}</h1>
      <p className="text-muted-foreground mt-2 max-w-2xl">{t('home.schools.directorySubtitle')}</p>

      <nav className="flex flex-wrap gap-2 mt-6 mb-8" aria-label={t('common.city')}>
        <Link href="/schools" className={cn('px-4 py-1.5 rounded-full text-sm border', !city ? 'bg-dark-gray text-white border-dark-gray' : 'bg-white border-border hover:border-primary')}>
          {t('home.schools.allCities')}
        </Link>
        {cities.map((c) => (
          <Link
            key={c.slug}
            href={`/schools?city=${c.slug}`}
            className={cn('px-4 py-1.5 rounded-full text-sm border', city === c.slug ? 'bg-dark-gray text-white border-dark-gray' : 'bg-white border-border hover:border-primary')}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {schools.length === 0 ? (
        <p className="bg-white rounded-2xl p-10 text-center text-muted-foreground">{t('home.schools.empty')}</p>
      ) : (
        <SchoolCards schools={schools} t={t} locale={locale} />
      )}
    </div>
  )
}
