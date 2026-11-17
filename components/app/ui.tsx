// Small presentational building blocks shared by the admin, school and student
// areas. Styling follows the existing admin pages.

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'w-full px-3 py-2 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60'
export const buttonClass =
  'inline-flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#E05530] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 bg-white border border-border text-dark-gray px-4 py-2 rounded-lg text-sm font-medium hover:bg-cream transition-colors disabled:opacity-50'
export const dangerButtonClass =
  'inline-flex items-center justify-center gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50'

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="text-sm text-muted-foreground hover:text-primary mb-2 inline-block">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-poppins text-2xl font-bold text-dark-gray break-words">{title}</h2>
          {description && <div className="text-muted-foreground mt-1 text-sm">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('bg-white rounded-lg shadow-soft p-5 md:p-6', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title && <h3 className="font-poppins text-lg font-bold text-dark-gray">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

const TONES = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  orange: 'bg-orange-100 text-orange-800',
  red: 'bg-red-100 text-red-800',
  purple: 'bg-purple-100 text-purple-800',
  primary: 'bg-primary text-white',
} as const
export type Tone = keyof typeof TONES

export function Badge({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap', TONES[tone], className)}>{children}</span>
}

export const STATUS_TONES: Record<string, Tone> = {
  DISCOVERED: 'gray',
  VERIFIED: 'blue',
  PARTNER: 'green',
  INACTIVE: 'red',
  NOT_CONTACTED: 'gray',
  CONTACTED: 'blue',
  INVITED: 'purple',
  CLAIM_PENDING: 'yellow',
  ONBOARDED: 'green',
  DECLINED: 'red',
  PENDING: 'yellow',
  APPROVED: 'green',
  REJECTED: 'red',
  DRAFT: 'gray',
  PENDING_APPROVAL: 'yellow',
  PUBLISHED: 'green',
  ARCHIVED: 'gray',
  OPEN: 'green',
  PAUSED: 'orange',
  CLOSED: 'red',
  FULL: 'purple',
  PENDING_PAYMENT: 'yellow',
  CONFIRMED: 'green',
  CANCELLED: 'red',
  EXPIRED: 'gray',
  FAILED_REFUNDED: 'orange',
  TRANSFERRED: 'blue',
  SUCCEEDED: 'green',
  FAILED: 'red',
  REFUNDED: 'orange',
  PARTIALLY_REFUNDED: 'orange',
  NEW: 'yellow',
  RESPONDED: 'green',
  IN_PROGRESS: 'blue',
  RESOLVED: 'green',
  NOT_STARTED: 'gray',
  DONE: 'green',
  INSTANT: 'green',
  ENQUIRY: 'blue',
  UNAVAILABLE: 'gray',
  ACTIVE: 'green',
  TRIAL: 'blue',
  PAST_DUE: 'red',
  NONE: 'gray',
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'gray'}>{label}</Badge>
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="font-poppins text-2xl font-bold text-dark-gray">{value}</p>
      <p className="text-muted-foreground text-xs font-medium mt-1">{label}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </>
  )
  return href ? (
    <Link href={href} className="block bg-white rounded-lg shadow-soft p-4 hover:shadow-premium transition-shadow">
      {body}
    </Link>
  ) : (
    <div className="bg-white rounded-lg shadow-soft p-4">{body}</div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-center text-muted-foreground py-10 text-sm">{children}</p>
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="block text-sm font-medium text-dark-gray mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground mt-1">{hint}</span>}
    </label>
  )
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div className="overflow-x-auto -mx-5 md:-mx-6">
      <table className="w-full text-sm">
        <thead className="bg-cream border-y border-border">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 md:px-6 py-2.5 text-start font-semibold text-dark-gray whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasRows ? (
            children
          ) : (
            <tr>
              <td colSpan={head.length} className="px-6 py-10 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('px-4 md:px-6 py-3 border-b border-border align-top', className)}>{children}</td>
}

export function DefinitionList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid sm:grid-cols-[minmax(0,12rem)_1fr] gap-x-6 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-dark-gray break-words">{v ?? '–'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Pager({ page, pageCount, href, label }: { page: number; pageCount: number; href: (page: number) => string; label: string }) {
  if (pageCount <= 1) return null
  return (
    <nav className="flex items-center justify-between gap-3 pt-4 text-sm">
      <Link href={href(Math.max(1, page - 1))} aria-disabled={page <= 1} className={cn(secondaryButtonClass, page <= 1 && 'pointer-events-none opacity-40')}>
        ←
      </Link>
      <span className="text-muted-foreground">{label}</span>
      <Link href={href(Math.min(pageCount, page + 1))} aria-disabled={page >= pageCount} className={cn(secondaryButtonClass, page >= pageCount && 'pointer-events-none opacity-40')}>
        →
      </Link>
    </nav>
  )
}
