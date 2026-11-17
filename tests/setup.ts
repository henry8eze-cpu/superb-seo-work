import { afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { MockEmailService } from '@/lib/email'
import { setPaymentProvider } from '@/lib/payments'
import { MockPaymentProvider } from '@/lib/payments/mock'

export let payments = new MockPaymentProvider()

beforeEach(async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`)
  MockEmailService.outbox = []
  payments = new MockPaymentProvider()
  setPaymentProvider(payments)
})

afterAll(async () => {
  await prisma.$disconnect()
})
