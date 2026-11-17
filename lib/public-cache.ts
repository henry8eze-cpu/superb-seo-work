// Short-lived shared cache for public, read-only catalogue data (landing page,
// school directory, school profiles, filter lists). Search results, course pages,
// checkout and all booking checks always read live data.
//
// Anything that changes what students can see calls invalidatePublicCatalog(),
// so the next visitor gets fresh data immediately; the time limit is only a
// safety net.

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'

export const PUBLIC_CATALOG_TAG = 'public-catalog'
const MAX_AGE_SECONDS = 60

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

/** Cached values come back as JSON; turn ISO date strings back into Date objects. */
function reviveDates<T>(value: T): T {
  if (typeof value === 'string') return (ISO_DATE.test(value) ? new Date(value) : value) as T
  if (Array.isArray(value)) return value.map(reviveDates) as T
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reviveDates(v)])) as T
  }
  return value
}

/** Wraps a read-only loader in the public catalogue cache. Arguments become part of the key. */
export function cachedPublic<Args extends unknown[], Result>(key: string, loader: (...args: Args) => Promise<Result>) {
  const cached = unstable_cache(loader, ['public', key], { tags: [PUBLIC_CATALOG_TAG], revalidate: MAX_AGE_SECONDS })
  return async (...args: Args) => reviveDates(await cached(...args))
}

/** Call after any change to schools, courses, intakes, seats or bookings. */
export function invalidatePublicCatalog() {
  try {
    revalidateTag(PUBLIC_CATALOG_TAG, { expire: 0 })
  } catch (error) {
    // Outside a request (scripts, tests) there is no cache to clear.
    if (process.env.NODE_ENV !== 'test') console.warn('[cache] could not invalidate public catalogue', error)
  }
}

/** revalidatePath plus clearing the public catalogue cache, for server actions that change public data. */
export function revalidatePublic(path: string, type?: 'layout' | 'page') {
  revalidatePath(path, type)
  invalidatePublicCatalog()
}
