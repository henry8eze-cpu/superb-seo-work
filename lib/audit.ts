import type { ActorType, Prisma } from '@prisma/client'
import { prisma } from './prisma'

export type Db = Prisma.TransactionClient | typeof prisma

export type AuditInput = {
  actorId?: string | null
  actorType?: ActorType
  schoolId?: string | null
  entity: string
  entityId: string
  action: string
  before?: unknown
  after?: unknown
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

/** Records who changed what. Pass the transaction client so the audit row commits with the change. */
export async function audit(db: Db, input: AuditInput) {
  await db.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      actorType: input.actorType ?? (input.actorId ? 'USER' : 'SYSTEM'),
      schoolId: input.schoolId ?? null,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      before: toJson(input.before),
      after: toJson(input.after),
    },
  })
}

/** Keeps only the keys whose values differ, so audit rows stay small and readable. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {}
  const a: Record<string, unknown> = {}
  for (const key of Object.keys(after)) {
    const prev = before[key]
    const next = after[key]
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      b[key] = prev
      a[key] = next
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 }
}
