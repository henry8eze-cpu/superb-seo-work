import Link from 'next/link'
import { AlertCircle, BookOpen, CalendarClock, CheckCircle2, FileWarning, MessageSquare, Plus, Receipt, RotateCcw, Store, Users, XCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSchoolActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { intlLocale } from '@/lib/i18n'
import { formatDateTime, toDayInput } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { STALE_AFTER_DAYS } from '@/lib/config'
import { getSchoolDashboard } from '@/lib/services/school-dashboard'
import { confirmIntakesAction, markNotificationsReadAction } from '@/app/actions/school'
import { ActionButton } from '@/components/app/action-form'
import { buttonClass, Card, inputClass, secondaryButtonClass } from '@/components/app/ui'
import { OccupancyChart, RevenueByCourseChart, StatTile, WeeklyBookingsChart } from '@/components/school/dashboard-charts'

export const metadata = { title: 'Dashboard | School app' }

const DAY = 86_400_000

export default async function SchoolDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireSchoolActor()
  const { t, locale } = await getT()
  const params = await searchParams
  const money = (cents: number) => formatMoney(cents, 'EUR', locale)

  const now = new Date()
  const from = params.from ? new Date(`${params.from}T00:00:00Z`) : new Date(now.getTime() - 30 * DAY)
  const to = params.to ? new Date(new Date(`${params.to}T00:00:00Z`).getTime() + DAY) : new Date(now.getTime() + DAY)

  const [school, branches, courseTypes, data, notifications] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: actor.schoolId } }),
    prisma.branch.findMany({ where: { schoolId: actor.schoolId, archivedAt: null }, orderBy: { name: 'asc' } }),
    prisma.courseType.findMany({ where: { schoolId: actor.schoolId, publicationStatus: { not: 'ARCHIVED' } }, orderBy: { name: 'asc' } }),
    getSchoolDashboard({ schoolId: actor.schoolId, branchId: params.branch, courseTypeId: params.course, from, to }, now),
    prisma.notification.findMany({ where: { schoolId: actor.schoolId }, orderBy: { createdAt: 'desc' }, take: 6 }),
  ])
  const { tiles, todo } = data
  const finances = actor.permissions.viewFinances
  const occupancyPct = tiles.occupancy.capacity ? Math.round((tiles.occupancy.sold / tiles.occupancy.capacity) * 100) : 0
  const unread = notifications.filter((n) => !n.readAt).length

  const todoItems = [
    { count: todo.newEnquiries, label: t('school.dashboard.todoNewEnquiries'), href: '/school/enquiries', icon: MessageSquare },
    { count: todo.cancellationRequests, label: t('school.dashboard.todoCancellations'), href: '/school/bookings?requests=1', icon: XCircle },
    { count: todo.staleIntakes, label: t('school.dashboard.todoStale', { days: STALE_AFTER_DAYS }), href: '/school/courses', icon: RotateCcw },
    { count: todo.startingSoon, label: t('school.dashboard.todoStartingSoon'), href: '/school/courses', icon: CalendarClock },
    { count: todo.rejectedCourses, label: t('school.dashboard.todoRejected'), href: '/school/courses', icon: FileWarning },
    { count: todo.draftCourses, label: t('school.dashboard.todoDrafts'), href: '/school/courses', icon: BookOpen },
    ...(finances && todo.outstandingCents > 0
      ? [{ count: money(todo.outstandingCents), label: t('school.dashboard.todoOutstanding'), href: '/school/bookings?status=CONFIRMED', icon: Receipt }]
      : []),
  ].filter((item) => item.count !== 0)

  const quickActions = [
    ...(actor.permissions.manageCourses ? [{ href: '/school/courses/new', label: t('school.dashboard.actionNewCourse'), icon: Plus }] : []),
    { href: '/school/bookings', label: t('school.dashboard.actionBookings'), icon: Users },
    { href: '/school/enquiries', label: t('school.dashboard.actionEnquiries'), icon: MessageSquare },
    { href: '/school/profile', label: t('school.dashboard.actionProfile'), icon: Store },
  ]

  return (
    <div className="space-y-6">
      {/* Greeting + quick actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="font-poppins text-2xl md:text-3xl font-bold text-dark-gray">{t('school.dashboard.greeting', { name: actor.name.split(' ')[0] })}</h2>
          <p className="text-muted-foreground mt-1">{t('school.dashboard.overviewFor', { school: school.name })}</p>
        </div>
        <nav aria-label={t('school.dashboard.quickActions')} className="flex flex-wrap gap-2">
          {quickActions.map((a, i) => (
            <Link key={a.href} href={a.href} className={i === 0 ? buttonClass : secondaryButtonClass}>
              <a.icon className="w-4 h-4" />
              {a.label}
            </Link>
          ))}
        </nav>
      </div>

      {school.status !== 'PARTNER' ? (
        <p className="bg-blue-50 text-blue-900 rounded-xl px-4 py-3 text-sm flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {t('school.notPartnerBanner')}
        </p>
      ) : (
        !school.instantBookingEnabled && (
          <p className="bg-yellow-50 text-yellow-900 rounded-xl px-4 py-3 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {t('school.instantOffBanner')}{' '}
              <Link href="/school/profile" className="underline font-medium">
                {t('school.nav.profile')}
              </Link>
            </span>
          </p>
        )
      )}

      {/* Filters: one row above everything they affect */}
      <form method="get" className="bg-white rounded-2xl shadow-soft p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto] items-center">
        <select name="branch" defaultValue={params.branch ?? ''} className={inputClass} aria-label={t('school.courses.branch')}>
          <option value="">{t('school.dashboard.allBranches')}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="course" defaultValue={params.course ?? ''} className={inputClass} aria-label={t('admin.bookings.course')}>
          <option value="">{t('school.dashboard.allCourses')}</option>
          {courseTypes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={params.from ?? toDayInput(from)} className={inputClass} aria-label={t('common.from')} />
        <input type="date" name="to" defaultValue={params.to ?? ''} className={inputClass} aria-label={t('common.to')} />
        <button className={buttonClass}>{t('common.filter')}</button>
      </form>
      <p className="text-xs text-muted-foreground -mt-4 px-1">{t('school.dashboard.periodHint')}</p>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
        <StatTile label={t('school.dashboard.newBookings')} value={String(tiles.newBookings.now)} current={tiles.newBookings.now} previous={tiles.newBookings.prev} />
        <StatTile label={t('school.dashboard.confirmed')} value={String(tiles.confirmed.now)} current={tiles.confirmed.now} previous={tiles.confirmed.prev} />
        <StatTile
          label={t('school.dashboard.cancellations')}
          value={String(tiles.cancellations.now)}
          current={tiles.cancellations.now}
          previous={tiles.cancellations.prev}
          upIsGood={false}
        />
        {finances && (
          <StatTile label={t('school.dashboard.revenue')} value={new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency: 'EUR', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(tiles.revenueCents.now / 100)} current={tiles.revenueCents.now} previous={tiles.revenueCents.prev} cents />
        )}
        <StatTile
          label={t('school.dashboard.occupancyRate')}
          value={`${occupancyPct} %`}
          hint={t('school.dashboard.seatsOf', { sold: tiles.occupancy.sold, capacity: tiles.occupancy.capacity })}
        />
        <StatTile
          label={t('school.dashboard.enquiriesPeriod')}
          value={String(tiles.enquiries.now)}
          hint={tiles.enquiries.responseHours === null ? t('school.dashboard.noReplyData') : t('school.dashboard.medianReply', { hours: tiles.enquiries.responseHours.toFixed(1) })}
        />
      </div>

      <div className="grid xl:grid-cols-3 gap-6 items-start">
        <Card title={t('school.dashboard.weeklyTitle')} className="xl:col-span-2 rounded-2xl">
          <p className="text-xs text-muted-foreground -mt-2 mb-3">{t('school.dashboard.weeklySubtitle')}</p>
          <WeeklyBookingsChart weeks={data.weeks} />
        </Card>

        <Card title={t('school.dashboard.todoTitle')} className="rounded-2xl">
          {todoItems.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-green-800 bg-green-50 rounded-lg px-3 py-3">
              <CheckCircle2 className="w-4 h-4" /> {t('school.dashboard.allClear')}
            </p>
          ) : (
            <ul className="divide-y divide-border -my-2">
              {todoItems.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="flex items-center gap-3 py-3 group">
                    <span className="w-9 h-9 rounded-lg bg-cream text-primary flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 text-sm group-hover:text-primary">{item.label}</span>
                    <span className="font-poppins font-semibold text-dark-gray tabular-nums">{item.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid xl:grid-cols-3 gap-6 items-start">
        <Card
          title={t('school.dashboard.occupancyTitle')}
          className="xl:col-span-2 rounded-2xl"
          actions={
            actor.permissions.manageCourses && data.occupancy.length > 0 ? (
              <ActionButton action={confirmIntakesAction.bind(null, data.occupancy.map((o) => o.id))} successMessage={t('school.dashboard.confirmed_toast')} className="px-3 py-1.5 text-xs">
                {t('school.dashboard.confirmAll')}
              </ActionButton>
            ) : undefined
          }
        >
          <p className="text-xs text-muted-foreground -mt-2 mb-3">{t('school.dashboard.occupancySubtitle')}</p>
          <OccupancyChart rows={data.occupancy} hrefBase="/school/intakes/" />
        </Card>

        {finances ? (
          <Card title={t('school.dashboard.revenueTitle')} className="rounded-2xl">
            <RevenueByCourseChart rows={data.revenueByCourse} />
          </Card>
        ) : (
          <div />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Card title={t('school.dashboard.activityTitle')} className="rounded-2xl">
          {data.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {data.activity.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-primary/60 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="text-dark-gray">{a.action}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(a.at, locale)} · {a.actor ?? (a.actorType === 'PAYMENT_PROVIDER' ? t('admin.audit.paymentProvider') : t('admin.audit.system'))}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card
          title={t('school.dashboard.notifications')}
          className="rounded-2xl"
          actions={
            unread > 0 ? (
              <ActionButton action={markNotificationsReadAction} className="px-2 py-1 text-xs" silent>
                {t('school.dashboard.markRead')}
              </ActionButton>
            ) : undefined
          }
        >
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>
          ) : (
            <ul className="divide-y divide-border text-sm -my-2">
              {notifications.map((n) => (
                <li key={n.id} className={`py-2.5 ${n.readAt ? 'text-muted-foreground' : ''}`}>
                  {n.link ? (
                    <Link href={n.link} className="hover:text-primary font-medium">
                      {n.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{n.title}</span>
                  )}
                  <p className="text-xs text-muted-foreground">{formatDateTime(n.createdAt, locale)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
