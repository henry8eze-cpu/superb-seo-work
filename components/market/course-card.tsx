import Link from 'next/link'
import { CalendarDays, Clock, MapPin, Zap, MessageCircle, Ban } from 'lucide-react'
import type { Translate } from '@/lib/i18n'
import type { SearchResult } from '@/lib/services/search'
import { formatDate, formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const MODE_STYLE = {
  INSTANT: { className: 'bg-green-600 text-white', icon: Zap },
  ENQUIRY: { className: 'bg-blue-100 text-blue-900', icon: MessageCircle },
  UNAVAILABLE: { className: 'bg-gray-200 text-gray-700', icon: Ban },
} as const

export function ModeBadge({ mode, t, reason }: { mode: SearchResult['mode']; t: Translate; reason?: string }) {
  const style = MODE_STYLE[mode]
  const Icon = style.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', style.className)}>
      <Icon className="w-3.5 h-3.5" />
      {mode === 'UNAVAILABLE' && reason ? t(`enums.unavailableReason.${reason}`) : t(`enums.mode.${mode}`)}
    </span>
  )
}

export function seatsLabel(t: Translate, available: number) {
  return available === 1 ? t('common.oneSeatLeft') : t('common.seatsLeft', { count: available })
}

export function CourseCard({ result, t, locale }: { result: SearchResult; t: Translate; locale: string }) {
  const { intake, mode, available, distanceKm } = result
  const { courseType, school } = intake
  const branch = courseType.branch
  const weeks = Math.round((intake.endDate.getTime() - intake.startDate.getTime()) / (7 * 86_400_000))

  return (
    <Link
      href={`/courses/${intake.id}`}
      className={cn(
        'block bg-white rounded-lg shadow-soft p-5 hover:shadow-premium transition-shadow border-2',
        mode === 'INSTANT' ? 'border-transparent hover:border-green-600/30' : 'border-transparent',
        mode === 'UNAVAILABLE' && 'opacity-75'
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <ModeBadge mode={mode} t={t} reason={result.reason} />
        <span className="text-xs font-semibold bg-cream px-2 py-1 rounded">{courseType.level}</span>
      </div>
      <h3 className="font-poppins font-bold text-dark-gray text-lg leading-snug">{courseType.name}</h3>
      <p className="text-sm text-muted-foreground mb-3">{school.name}</p>

      <ul className="space-y-1.5 text-sm text-dark-gray">
        <li className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
          <span>
            {t('market.search.starts', { date: formatDay(intake.startDate, locale) })} · {t('common.weeks', { count: Math.max(1, weeks) })}
          </span>
        </li>
        <li className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          <span>
            {intake.weekdays.map((d) => t(`weekdays.short.${d}`)).join(', ')} · {intake.startTime}–{intake.endTime} · {t('common.perWeek', { count: courseType.lessonsPerWeek })}
          </span>
        </li>
        <li className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span>
            {courseType.format === 'ONLINE' || branch.isOnline ? t('common.online') : [branch.cityName, branch.postcode].filter(Boolean).join(' ')}
            {courseType.format === 'HYBRID' && ` · ${t('enums.format.HYBRID')}`}
            {distanceKm !== null && ` · ${t('common.km', { km: distanceKm.toFixed(1) })}`}
          </span>
        </li>
      </ul>

      <div className="flex items-end justify-between gap-3 mt-4 pt-4 border-t border-border">
        <div>
          <p className="font-poppins text-xl font-bold text-dark-gray">{formatMoney(intake.totalPriceCents, intake.currency, locale)}</p>
          <p className="text-xs text-muted-foreground">{t('market.search.totalPrice')}</p>
        </div>
        <div className="text-end">
          {mode === 'INSTANT' && (
            <p className={cn('text-sm font-semibold', available <= 3 ? 'text-primary' : 'text-green-700')}>{seatsLabel(t, available)}</p>
          )}
          {mode === 'ENQUIRY' && <p className="text-sm font-medium text-blue-900">{t('market.course.placesUnconfirmed')}</p>}
          <p className="text-[11px] text-muted-foreground">{t('common.lastConfirmed', { date: formatDate(intake.lastConfirmedAt, locale) })}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">{t(`enums.modeHint.${mode}`)}</p>
    </Link>
  )
}
