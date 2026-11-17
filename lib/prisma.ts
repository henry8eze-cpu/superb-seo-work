import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Opening a connection to the database (TLS + auth) is far slower than a query
// (~1.5 s vs ~0.15 s from here to Neon in Frankfurt). pg's default closes idle
// connections after 10 s, so almost every page view after a short pause paid
// for new connections. Keep a few open instead.
const POOL = {
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  // Idle connections at or below `min` are never closed.
  min: Number(process.env.DATABASE_POOL_MIN || 2),
  // Connections above `min` stay open for 5 minutes of inactivity.
  idleTimeoutMillis: 5 * 60_000,
  // Detect connections the network silently dropped.
  keepAlive: true,
  connectionTimeoutMillis: 15_000,
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // The adapter owns the pool, so $disconnect() closes it cleanly, and it already
    // handles errors from idle connections (e.g. the server closing one).
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      ...POOL,
    }),
    // Printing every query slows the dev server down; opt in with PRISMA_LOG_QUERIES=1.
    log: process.env.PRISMA_LOG_QUERIES === '1' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
