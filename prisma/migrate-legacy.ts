// Usage: npx tsx prisma/migrate-legacy.ts
// Run once after `prisma migrate deploy`. Safe to run again.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { migrateLegacy } from './legacy'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

migrateLegacy(prisma)
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
