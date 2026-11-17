import type { AuditEvent } from '@prisma/client'
import type { Translate } from '@/lib/i18n'
import { formatDateTime } from '@/lib/dates'

type Event = AuditEvent & { actor: { name: string } | null }

function summarize(value: unknown) {
  if (!value || typeof value !== 'object') return ''
  return Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(', ')
}

/** Compact "who changed what, when" list. */
export function AuditList({ events, t, locale, showEntity = false }: { events: Event[]; t: Translate; locale: string; showEntity?: boolean }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>
  return (
    <ol className="space-y-3 text-sm">
      {events.map((event) => {
        const before = summarize(event.before)
        const after = summarize(event.after)
        return (
          <li key={event.id} className="border-s-2 border-border ps-3">
            <p>
              <span className="font-medium text-dark-gray">{event.action}</span>
              {showEntity && <span className="text-muted-foreground"> · {event.entity}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(event.createdAt, locale)} ·{' '}
              {event.actor?.name ?? (event.actorType === 'PAYMENT_PROVIDER' ? t('admin.audit.paymentProvider') : t('admin.audit.system'))}
            </p>
            {(before || after) && (
              <p className="text-xs mt-1 break-words">
                {before && <span className="line-through text-muted-foreground me-2">{before}</span>}
                {after && <span className="text-dark-gray">{after}</span>}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
