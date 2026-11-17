// Imports NRW postcode centroids for distance search.
//
// 1. Download https://download.geonames.org/export/zip/DE.zip (CC BY 4.0) and unzip DE.txt.
// 2. npx tsx scripts/import-postcodes.ts path/to/DE.txt
//
// GeoNames lists several places per postcode; we store the average position.
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

async function main() {
  const file = process.argv[2]
  if (!file) throw new Error('Usage: npx tsx scripts/import-postcodes.ts DE.txt')

  const byPostcode = new Map<string, { place: string; lat: number; lng: number; n: number }>()
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const cols = line.split('\t')
    // country, postcode, place, admin1 name, admin1 code, …, lat (9), lng (10)
    if (cols.length < 11 || cols[3] !== 'Nordrhein-Westfalen') continue
    const lat = Number(cols[9])
    const lng = Number(cols[10])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const row = byPostcode.get(cols[1]) ?? { place: cols[2], lat: 0, lng: 0, n: 0 }
    row.lat += lat
    row.lng += lng
    row.n++
    byPostcode.set(cols[1], row)
  }

  let count = 0
  for (const [postcode, row] of byPostcode) {
    const data = { place: row.place, lat: row.lat / row.n, lng: row.lng / row.n }
    await prisma.postcodeLocation.upsert({ where: { postcode }, update: data, create: { postcode, ...data } })
    count++
  }
  console.log(`Imported ${count} NRW postcodes.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
