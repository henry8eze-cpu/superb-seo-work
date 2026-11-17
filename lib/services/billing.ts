// Per-school commercial terms. Nothing is hard-coded: every school gets its own
// commission and optional subscription price, set by the internal team.

import { z } from 'zod'
import { prisma } from '../prisma'
import { audit } from '../audit'
import { AppError } from '../errors'
import { assertPlatformAdmin, type Actor } from '../permissions'
import { activeTerms } from '../booking/rules'

export const commissionTermsSchema = z
  .object({
    type: z.enum(['FIXED', 'PERCENT']),
    fixedCents: z.number().int().min(0).optional(),
    percentBps: z.number().int().min(0).max(10_000).optional(),
    validFrom: z.string().optional(),
    note: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || undefined),
  })
  .refine((v) => (v.type === 'FIXED' ? v.fixedCents !== undefined : v.percentBps !== undefined), {
    message: 'Enter an amount or a percentage',
  })

/** New terms apply from `validFrom` (default now). The previous terms end at that moment; bookings keep the terms they were confirmed under. */
export async function setCommissionTerms(actor: Actor, schoolId: string, input: z.input<typeof commissionTermsSchema>) {
  assertPlatformAdmin(actor)
  const data = commissionTermsSchema.parse(input)
  const validFrom = data.validFrom ? new Date(data.validFrom) : new Date()
  return prisma.$transaction(async (tx) => {
    const school = await tx.school.findUnique({ where: { id: schoolId }, select: { id: true } })
    if (!school) throw new AppError('NOT_FOUND')
    const current = activeTerms(await tx.commissionTerms.findMany({ where: { schoolId } }), validFrom)
    if (current) await tx.commissionTerms.update({ where: { id: current.id }, data: { validTo: validFrom } })
    const terms = await tx.commissionTerms.create({
      data: {
        schoolId,
        type: data.type,
        fixedCents: data.type === 'FIXED' ? data.fixedCents : null,
        percentBps: data.type === 'PERCENT' ? data.percentBps : null,
        validFrom,
        note: data.note,
        createdById: actor.userId,
      },
    })
    await audit(tx, {
      actorId: actor.userId,
      schoolId,
      entity: 'CommissionTerms',
      entityId: terms.id,
      action: 'billing.commission_changed',
      before: current ? { type: current.type, fixedCents: current.fixedCents, percentBps: current.percentBps } : null,
      after: { type: terms.type, fixedCents: terms.fixedCents, percentBps: terms.percentBps, validFrom },
    })
    return terms
  })
}

export const subscriptionSchema = z.object({
  monthlyPriceCents: z.number().int().min(0),
  status: z.enum(['NONE', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED']),
  startedAt: z.string().optional(),
  note: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
})

export async function setSubscription(actor: Actor, schoolId: string, input: z.input<typeof subscriptionSchema>) {
  assertPlatformAdmin(actor)
  const data = subscriptionSchema.parse(input)
  return prisma.$transaction(async (tx) => {
    const existing = await tx.subscription.findFirst({ where: { schoolId }, orderBy: { createdAt: 'desc' } })
    const fields = {
      monthlyPriceCents: data.monthlyPriceCents,
      status: data.status,
      startedAt: data.startedAt ? new Date(data.startedAt) : existing?.startedAt ?? (data.status === 'ACTIVE' || data.status === 'TRIAL' ? new Date() : null),
      note: data.note ?? null,
    }
    const subscription = existing
      ? await tx.subscription.update({ where: { id: existing.id }, data: fields })
      : await tx.subscription.create({ data: { schoolId, ...fields } })
    await audit(tx, {
      actorId: actor.userId,
      schoolId,
      entity: 'Subscription',
      entityId: subscription.id,
      action: 'billing.subscription_changed',
      before: existing ? { monthlyPriceCents: existing.monthlyPriceCents, status: existing.status } : null,
      after: { monthlyPriceCents: subscription.monthlyPriceCents, status: subscription.status },
    })
    return subscription
  })
}
