import { getActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { languageName } from '@/lib/i18n'
import { logSearch, parseSearchParams, searchCourses } from '@/lib/services/search'
import { getSearchFilterOptionsCached } from '@/lib/services/landing'
import { CourseCard } from '@/components/market/course-card'
import { buttonClass, EmptyState, inputClass, Pager } from '@/components/app/ui'

export const metadata = {
  title: 'Deutschkurse in NRW finden | German courses in NRW',
  description: 'Search German courses in NRW by city, level, schedule and price. Book instantly where a place is confirmed.',
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
const CATEGORIES = ['INTENSIVE', 'EVENING', 'WEEKEND', 'PRIVATE', 'EXAM_PREP', 'INTEGRATION', 'STANDARD'] as const

export default async function CoursesSearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const filters = parseSearchParams(params)
  const [{ t, locale }, actor, { cities, languages }] = await Promise.all([getT(), getActor(), getSearchFilterOptionsCached()])
  const { results, total, page, pageCount, originFound } = await searchCourses(filters)
  if (page === 1) await logSearch(filters, total, actor?.userId)

  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (k === 'page' || v === undefined) continue
    for (const value of Array.isArray(v) ? v : [v]) query.append(k, value)
  }

  const filterForm = (
    <form method="get" className="space-y-5 text-sm">
      <fieldset className="space-y-2">
        <legend className="font-semibold text-dark-gray mb-1">{t('market.search.where')}</legend>
        <select name="city" defaultValue={filters.city ?? ''} className={inputClass} aria-label={t('market.search.city')}>
          <option value="">{t('market.search.anyCity')}</option>
          {cities.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <input name="postcode" defaultValue={filters.postcode} placeholder={t('market.search.postcode')} inputMode="numeric" maxLength={5} className={inputClass} />
          <select name="radius" defaultValue={String(filters.radiusKm ?? 25)} className={inputClass} aria-label={t('market.search.radius')}>
            {[5, 10, 25, 50].map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-semibold text-dark-gray mb-1">{t('market.search.format')}</legend>
        <select name="format" defaultValue={filters.format ?? ''} className={inputClass}>
          <option value="">{t('market.search.any')}</option>
          {(['IN_PERSON', 'ONLINE', 'HYBRID'] as const).map((f) => (
            <option key={f} value={f}>
              {t(`enums.format.${f}`)}
            </option>
          ))}
        </select>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="font-semibold text-dark-gray block mb-1">{t('market.search.language')}</span>
          <select name="language" defaultValue={filters.language ?? ''} className={inputClass}>
            <option value="">{t('market.search.any')}</option>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {languageName(l, locale)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="font-semibold text-dark-gray block mb-1">{t('market.search.level')}</span>
          <select name="level" defaultValue={filters.level ?? ''} className={inputClass}>
            <option value="">{t('market.search.any')}</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="font-semibold text-dark-gray block mb-1">{t('market.search.type')}</span>
        <select name="category" defaultValue={filters.category ?? ''} className={inputClass}>
          <option value="">{t('market.search.any')}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`enums.category.${c}`)}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="font-semibold text-dark-gray mb-1">{t('market.search.start')}</legend>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" name="from" defaultValue={filters.startFrom} className={inputClass} aria-label={t('common.from')} />
          <input type="date" name="to" defaultValue={filters.startTo} className={inputClass} aria-label={t('common.to')} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-semibold text-dark-gray mb-1">{t('market.search.days')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <label key={d} className="cursor-pointer border border-border rounded-lg px-2.5 py-1 has-[:checked]:bg-primary has-[:checked]:text-white has-[:checked]:border-primary">
              <input type="checkbox" name="days" value={d} defaultChecked={filters.weekdays?.includes(d)} className="sr-only" />
              {t(`weekdays.short.${d}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="font-semibold text-dark-gray block mb-1">{t('market.search.time')}</span>
        <select name="time" defaultValue={filters.timeOfDay ?? ''} className={inputClass}>
          <option value="">{t('market.search.any')}</option>
          {(['morning', 'afternoon', 'evening'] as const).map((v) => (
            <option key={v} value={v}>
              {t(`enums.timeOfDay.${v}`)}
            </option>
          ))}
        </select>
      </label>

      {(
        [
          ['duration', 'minWeeks', 'maxWeeks', filters.minWeeks, filters.maxWeeks],
          ['lessons', 'minLessons', 'maxLessons', filters.minLessons, filters.maxLessons],
          ['price', 'minPrice', 'maxPrice', filters.minPrice, filters.maxPrice],
        ] as const
      ).map(([label, minName, maxName, minValue, maxValue]) => (
        <fieldset key={label}>
          <legend className="font-semibold text-dark-gray mb-1">{t(`market.search.${label}`)}</legend>
          <div className="grid grid-cols-2 gap-2">
            <input name={minName} inputMode="decimal" defaultValue={minValue ?? ''} placeholder={t('market.search.min')} className={inputClass} />
            <input name={maxName} inputMode="decimal" defaultValue={maxValue ?? ''} placeholder={t('market.search.max')} className={inputClass} />
          </div>
        </fieldset>
      ))}

      <label className="flex items-center gap-2">
        <input type="checkbox" name="available" value="1" defaultChecked={filters.availableOnly} /> {t('market.search.availableOnly')}
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="instant" value="1" defaultChecked={filters.instantOnly} /> {t('market.search.instantOnly')}
      </label>

      <label className="block">
        <span className="font-semibold text-dark-gray block mb-1">{t('market.search.sort')}</span>
        <select name="sort" defaultValue={filters.sort} className={inputClass}>
          <option value="start">{t('market.search.sortStart')}</option>
          <option value="price">{t('market.search.sortPrice')}</option>
          <option value="distance">{t('market.search.sortDistance')}</option>
        </select>
      </label>

      <button className={`${buttonClass} w-full`}>{t('market.search.apply')}</button>
      <a href="/courses" className="block text-center text-muted-foreground hover:text-primary">
        {t('common.reset')}
      </a>
    </form>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-poppins text-3xl font-bold text-dark-gray mb-1">{t('market.search.title')}</h1>
      <p className="text-muted-foreground mb-6">{t('market.search.results', { count: total })}</p>
      <div className="grid lg:grid-cols-[18rem_1fr] gap-8 items-start">
        <aside className="bg-white rounded-lg shadow-soft p-5 lg:sticky lg:top-20">
          <details className="lg:hidden" open={false}>
            <summary className="font-semibold cursor-pointer">{t('market.search.filters')}</summary>
            <div className="mt-4">{filterForm}</div>
          </details>
          <div className="hidden lg:block">{filterForm}</div>
        </aside>
        <section>
          {!originFound && <p className="text-sm bg-yellow-50 text-yellow-900 rounded-lg px-3 py-2 mb-4">{t('market.search.postcodeUnknown')}</p>}
          {results.length === 0 ? (
            <div className="bg-white rounded-lg shadow-soft">
              <EmptyState>{t('market.search.noResults')}</EmptyState>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {results.map((result) => (
                <CourseCard key={result.intakeId} result={result} t={t} locale={locale} />
              ))}
            </div>
          )}
          <Pager
            page={page}
            pageCount={pageCount}
            href={(p) => `/courses?${new URLSearchParams([...query.entries(), ['page', String(p)]])}`}
            label={t('common.page', { page, pages: pageCount })}
          />
        </section>
      </div>
    </div>
  )
}
