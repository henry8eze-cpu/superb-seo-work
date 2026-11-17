import { prisma } from './prisma'
import { foldGerman, normalizePostcode } from './schools/normalize'

export type LatLng = { lat: number; lng: number }

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Postcode centroid from the imported PostcodeLocation table. */
export async function geocodePostcode(postcode: string | null | undefined): Promise<LatLng | null> {
  const code = normalizePostcode(postcode)
  if (!code) return null
  const row = await prisma.postcodeLocation.findUnique({ where: { postcode: code } })
  return row ? { lat: row.lat, lng: row.lng } : null
}

export async function findCityByName(name: string | null | undefined) {
  if (!name?.trim()) return null
  const folded = foldGerman(name.trim())
  const cities = await prisma.city.findMany({ select: { id: true, name: true, lat: true, lng: true } })
  return cities.find((c) => foldGerman(c.name) === folded) ?? null
}

/** Best-effort coordinates for a branch: postcode centroid, else the city centre. */
export async function locateBranch(input: { postcode?: string | null; cityName?: string | null }) {
  const city = await findCityByName(input.cityName)
  const point = (await geocodePostcode(input.postcode)) ?? (city?.lat && city?.lng ? { lat: city.lat, lng: city.lng } : null)
  return { cityId: city?.id ?? null, lat: point?.lat ?? null, lng: point?.lng ?? null }
}
