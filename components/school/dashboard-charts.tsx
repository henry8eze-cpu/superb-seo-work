'use client'

// Charts for the school dashboard. Plain SVG/HTML, hover tooltips, and a table
// view for every chart. Colors follow the validated two-series palette
// (blue = direct, orange = marketplace); text always uses text tokens.

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { intlLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const vizVars = {
  '--series-1': '#2a78d6', // direct
  '--series-2': '#eb6834', // marketplace
  '--track': '#edece8',
  '--grid': '#ecebe7',
  '--surface': '#ffffff',
  '--text-primary': '#2f2f2f',
  '--text-secondary': '#6b6258',
} as CSSProperties

const nf = (locale: string) => new Intl.NumberFormat(intlLocale(locale))
const euros = (locale: string) =>
  new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency: 'EUR', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 })

function niceMax(value: number) {
  if (value <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 2.5, 5, 10]) if (step * pow >= value) return step * pow
  return 10 * pow
}

function Tooltip({ x, y, children }: { x: number | string; y: number; children: ReactNode }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-dark-gray text-white text-xs px-3 py-2 shadow-premium whitespace-nowrap"
      style={{ left: x, top: y - 8 }}
    >
      {children}
    </div>
  )
}

function Swatch({ color }: { color: string }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} aria-hidden />
}

function TableToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { t } = useLanguage()
  return (
    <button type="button" onClick={onToggle} className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline">
      {shown ? t('school.dashboard.showChart') : t('school.dashboard.showTable')}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

/** Label, value and the change vs the previous period. `upIsGood` sets the delta color; `cents` formats an absolute change as money. */
export function StatTile({
  label,
  value,
  current,
  previous,
  upIsGood = true,
  cents = false,
  hint,
}: {
  label: string
  value: string
  current?: number
  previous?: number
  upIsGood?: boolean
  cents?: boolean
  hint?: string
}) {
  const { t, language } = useLanguage()
  let delta: ReactNode = null
  if (current !== undefined && previous !== undefined) {
    const diff = current - previous
    const pct = previous === 0 ? null : Math.round((diff / previous) * 100)
    const good = diff === 0 ? null : diff > 0 === upIsGood
    const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus
    delta = (
      <span className="block text-xs">
        <span className={cn('inline-flex items-center gap-0.5 font-medium whitespace-nowrap', good === null ? 'text-muted-foreground' : good ? 'text-green-700' : 'text-red-700')}>
          <Icon className="w-3.5 h-3.5" aria-hidden />
          {diff === 0 ? t('school.dashboard.noChange') : `${diff > 0 ? '+' : ''}${pct !== null ? `${pct} %` : cents ? euros(language).format(diff / 100) : diff}`}
        </span>
        <span className="block text-muted-foreground">{t('school.dashboard.vsPrevious')}</span>
      </span>
    )
  }
  return (
    <div className="bg-white rounded-2xl shadow-soft p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-poppins text-2xl md:text-3xl font-semibold text-dark-gray mt-1 whitespace-nowrap">{value}</p>
      <div className="mt-1 min-h-5">{delta ?? (hint && <span className="text-xs text-muted-foreground">{hint}</span>)}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weekly bookings: stacked columns, direct (bottom) + marketplace (top)
// ---------------------------------------------------------------------------

export function WeeklyBookingsChart({ weeks }: { weeks: { start: string; direct: number; marketplace: number }[] }) {
  const { t, language } = useLanguage()
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const fmt = nf(language)
  const dateFmt = new Intl.DateTimeFormat(intlLocale(language), { day: '2-digit', month: 'short', timeZone: 'UTC' })

  const width = 640
  const height = 220
  const pad = { top: 12, right: 8, bottom: 28, left: 32 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const max = niceMax(Math.max(0, ...weeks.map((w) => w.direct + w.marketplace)))
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max]
  const band = plotW / weeks.length
  const barW = Math.min(24, band * 0.6)
  const y = (v: number) => pad.top + plotH - (v / max) * plotH
  const total = weeks.reduce((s, w) => s + w.direct + w.marketplace, 0)

  // A bar with a 4px rounded top and a square base.
  const bar = (x: number, top: number, bottom: number, roundTop: boolean) => {
    const h = bottom - top
    if (h <= 0) return ''
    const r = roundTop ? Math.min(4, h, barW / 2) : 0
    return `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${bottom} Z`
  }

  return (
    <div style={vizVars}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]" aria-label={t('school.dashboard.legend')}>
          <span className="flex items-center gap-1.5">
            <Swatch color="var(--series-1)" /> {t('school.dashboard.direct')}
          </span>
          <span className="flex items-center gap-1.5">
            <Swatch color="var(--series-2)" /> {t('school.dashboard.marketplace')}
          </span>
        </div>
        <TableToggle shown={table} onToggle={() => setTable(!table)} />
      </div>

      {table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-start text-[var(--text-secondary)]">
              <th className="py-1 font-medium">{t('school.dashboard.weekOf')}</th>
              <th className="py-1 font-medium text-end">{t('school.dashboard.direct')}</th>
              <th className="py-1 font-medium text-end">{t('school.dashboard.marketplace')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {weeks.map((w) => (
              <tr key={w.start} className="border-t border-border">
                <td className="py-1">{dateFmt.format(new Date(w.start))}</td>
                <td className="py-1 text-end">{fmt.format(w.direct)}</td>
                <td className="py-1 text-end">{fmt.format(w.marketplace)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          {total === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-secondary)]">{t('school.dashboard.noBookingsYet')}</p>
          )}
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={t('school.dashboard.weeklyTitle')} onMouseLeave={() => setHover(null)}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" strokeWidth={1} />
                <text x={pad.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--text-secondary)">
                  {fmt.format(tick)}
                </text>
              </g>
            ))}
            {weeks.map((w, i) => {
              const x = pad.left + i * band + (band - barW) / 2
              const base = y(0)
              const directTop = y(w.direct)
              // 2px surface gap between the two segments.
              const gap = w.direct > 0 && w.marketplace > 0 ? 2 : 0
              const marketTop = y(w.direct + w.marketplace)
              return (
                <g key={w.start}>
                  <path d={bar(x, directTop, base, w.marketplace === 0)} fill="var(--series-1)" opacity={hover === null || hover === i ? 1 : 0.55} />
                  <path d={bar(x, marketTop, directTop - gap, true)} fill="var(--series-2)" opacity={hover === null || hover === i ? 1 : 0.55} />
                  {(i % 2 === 1 || weeks.length <= 8) && (
                    <text x={x + barW / 2} y={height - 10} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
                      {dateFmt.format(new Date(w.start))}
                    </text>
                  )}
                  {/* Hit target: the whole column band, larger than the mark. */}
                  <rect x={pad.left + i * band} y={pad.top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${dateFmt.format(new Date(w.start))}: ${w.direct} ${t('school.dashboard.direct')}, ${w.marketplace} ${t('school.dashboard.marketplace')}`} />
                </g>
              )
            })}
            <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke="#d6d4ce" strokeWidth={1} />
          </svg>
          {hover !== null && (
            <Tooltip x={`${((pad.left + hover * band + band / 2) / width) * 100}%`} y={0}>
              <p className="font-semibold mb-1">
                {t('school.dashboard.weekOf')} {dateFmt.format(new Date(weeks[hover].start))}
              </p>
              <p className="flex items-center gap-1.5">
                <Swatch color="var(--series-1)" /> {t('school.dashboard.direct')}: {fmt.format(weeks[hover].direct)}
              </p>
              <p className="flex items-center gap-1.5">
                <Swatch color="var(--series-2)" /> {t('school.dashboard.marketplace')}: {fmt.format(weeks[hover].marketplace)}
              </p>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seat occupancy per upcoming intake: booked + in checkout + free
// ---------------------------------------------------------------------------

export type OccupancyRow = { id: string; name: string; startDate: string; startTime: string; capacity: number; sold: number; held: number; free: number; status: string }

/** `hrefBase` (e.g. "/school/intakes/") links each row to its intake. */
export function OccupancyChart({ rows, hrefBase }: { rows: OccupancyRow[]; hrefBase?: string }) {
  const { t, language } = useLanguage()
  const [table, setTable] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const dateFmt = new Intl.DateTimeFormat(intlLocale(language), { day: '2-digit', month: 'short', timeZone: 'UTC' })

  return (
    <div style={vizVars}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <Swatch color="var(--series-1)" /> {t('school.dashboard.sold')}
          </span>
          <span className="flex items-center gap-1.5">
            <Swatch color="var(--series-2)" /> {t('school.dashboard.held')}
          </span>
          <span className="flex items-center gap-1.5">
            <Swatch color="var(--track)" /> {t('school.dashboard.available')}
          </span>
        </div>
        <TableToggle shown={table} onToggle={() => setTable(!table)} />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)] py-6 text-center">{t('common.noResults')}</p>
      ) : table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-start text-[var(--text-secondary)]">
              <th className="py-1 font-medium">{t('admin.bookings.course')}</th>
              <th className="py-1 font-medium text-end">{t('school.dashboard.sold')}</th>
              <th className="py-1 font-medium text-end">{t('school.dashboard.held')}</th>
              <th className="py-1 font-medium text-end">{t('school.dashboard.available')}</th>
              <th className="py-1 font-medium text-end">{t('school.intake.capacity')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-1">
                  {r.name} · {dateFmt.format(new Date(r.startDate))}
                </td>
                <td className="py-1 text-end">{r.sold}</td>
                <td className="py-1 text-end">{r.held}</td>
                <td className="py-1 text-end">{r.free}</td>
                <td className="py-1 text-end">{r.capacity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const pct = (v: number) => (r.capacity ? (v / r.capacity) * 100 : 0)
            const label = (
              <>
                <span className="block text-sm text-[var(--text-primary)] truncate">{r.name}</span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  {dateFmt.format(new Date(r.startDate))} · {r.startTime}
                  {r.status !== 'OPEN' && ` · ${t(`enums.intakeStatus.${r.status}`)}`}
                </span>
              </>
            )
            return (
              <li key={r.id} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 relative" onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}>
                {hrefBase ? (
                  <a href={`${hrefBase}${r.id}`} className="min-w-0 hover:[&>span:first-child]:text-primary">
                    {label}
                  </a>
                ) : (
                  <div className="min-w-0">{label}</div>
                )}
                <div className="flex h-3 rounded bg-[var(--track)] overflow-hidden" role="img" aria-label={`${r.sold} ${t('school.dashboard.sold')}, ${r.held} ${t('school.dashboard.held')}, ${r.free} ${t('school.dashboard.available')}`}>
                  {r.sold > 0 && <div style={{ width: `${pct(r.sold)}%`, background: 'var(--series-1)' }} />}
                  {r.held > 0 && <div style={{ width: `${pct(r.held)}%`, background: 'var(--series-2)', marginLeft: r.sold > 0 ? 2 : 0 }} />}
                </div>
                <span className="text-sm tabular-nums text-[var(--text-primary)] w-14 text-end">
                  {r.sold}/{r.capacity}
                </span>
                {hover === r.id && (
                  <div className="pointer-events-none absolute end-16 -top-9 z-10 rounded-lg bg-dark-gray text-white text-xs px-3 py-1.5 whitespace-nowrap">
                    {r.sold} {t('school.dashboard.sold')} · {r.held} {t('school.dashboard.held')} · {r.free} {t('school.dashboard.available')}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Revenue by course: single-series horizontal bars, value at the tip
// ---------------------------------------------------------------------------

export function RevenueByCourseChart({ rows }: { rows: { name: string; cents: number }[] }) {
  const { t, language } = useLanguage()
  const [table, setTable] = useState(false)
  const money = useMemo(() => euros(language), [language])
  const max = Math.max(1, ...rows.map((r) => r.cents))

  return (
    <div style={vizVars}>
      <div className="flex justify-end mb-3">
        <TableToggle shown={table} onToggle={() => setTable(!table)} />
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)] py-6 text-center">{t('common.noResults')}</p>
      ) : table ? (
        <table className="w-full text-sm">
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-border first:border-0">
                <td className="py-1">{r.name}</td>
                <td className="py-1 text-end">{money.format(r.cents / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.name} title={`${r.name}: ${money.format(r.cents / 100)}`}>
              <p className="text-sm text-[var(--text-primary)] truncate mb-1">{r.name}</p>
              <div className="flex items-center gap-2">
                <div className="h-3 rounded-e" style={{ width: `${Math.max(2, (r.cents / max) * 80)}%`, background: 'var(--series-1)' }} />
                <span className="text-sm tabular-nums text-[var(--text-secondary)] whitespace-nowrap">{money.format(r.cents / 100)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
