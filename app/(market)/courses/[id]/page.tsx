import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { CalendarDays, Clock, MapPin, ShieldCheck, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { languageName } from '@/lib/i18n'
import { formatDate, formatDateTime, formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { SEAT_HOLD_MINUTES } from '@/lib/config'
import { getAvailability } from '@/lib/booking/inventory'
import { bookingCloseTime, bookingMode } from '@/lib/booking/rules'
import { enquiryAction, startBookingAction } from '@/app/actions/marketplace'
import { ActionForm } from '@/components/app/action-form'
import { buttonClass, Field, inputClass } from '@/components/app/ui'
import { ModeBadge, seatsLabel } from '@/components/market/course-card'

async function loadIntake(id: string) {
  return prisma.intake.findUnique({
    where: { id },
    include: {
      fees: true,
      school: true,
      courseType: {
        include: {
          branch: true,
          language: true,
          intakes: { where: { archivedAt: null, id: { not: id }, startDate: { gte: new Date() } }, orderBy: { startDate: 'asc' }, take: 6 },
        },
      },
    },
  })
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const intake = await loadIntake((await params).id)
  if (!intake) return {}
  return { title: `${intake.courseType.name} – ${intake.school.name}`, description: intake.courseType.description?.slice(0, 160) }
}

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [intake, { t, locale }, actor] = await Promise.all([loadIntake(id), getT(), getActor()])
  const listed = intake && intake.courseType.publicationStatus === 'PUBLISHED' && !intake.archivedAt && ['VERIFIED', 'PARTNER'].includes(intake.school.status)
  if (!intake || !listed) notFound()

  const now = new Date()
  const availability = await getAvailability([intake.id, ...intake.courseType.intakes.map((i) => i.id)], now)
  const available = availability.get(intake.id)?.available ?? 0
  const { mode, reason } = bookingMode({ school: intake.school, courseType: intake.courseType, intake, available, now })
  const { courseType, school } = intake
  const branch = courseType.branch
  const money = (cents: number) => formatMoney(cents, intake.currency, locale)
  const online = courseType.format === 'ONLINE' || branch.isOnline

  const existing = actor
    ? await prisma.booking.findFirst({
        where: { intakeId: intake.id, studentUserId: actor.userId, OR: [{ status: 'CONFIRMED' }, { status: 'PENDING_PAYMENT', hold: { status: 'ACTIVE', expiresAt: { gt: now } } }] },
        select: { id: true, status: true },
      })
    : null

  const enquiryForm = (
    <ActionForm action={enquiryAction.bind(null, intake.id)} submitLabel={t('market.course.enquirySend')} successMessage={t('market.course.enquirySent')} resetOnSuccess>
      <Field label={t('common.name')}>
        <input name="name" required defaultValue={actor?.name} className={inputClass} />
      </Field>
      <Field label={t('common.email')}>
        <input name="email" type="email" required defaultValue={actor?.email} className={inputClass} />
      </Field>
      <Field label={`${t('common.phone')} (${t('common.optional')})`}>
        <input name="phone" className={inputClass} />
      </Field>
      <Field label={t('common.message')}>
        <textarea name="message" rows={4} required minLength={10} className={inputClass} />
      </Field>
      {/* Honeypot: real people leave this empty. */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
    </ActionForm>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/courses" className="text-sm text-muted-foreground hover:text-primary">
        ← {t('market.course.backToSearch')}
      </Link>

      <div className="grid lg:grid-cols-[1fr_22rem] gap-8 mt-4 items-start">
        <article className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <ModeBadge mode={mode} t={t} reason={reason} />
              <span className="text-xs font-semibold bg-white px-2 py-1 rounded">{t(`enums.level.${courseType.level}`)}</span>
              <span className="text-xs font-semibold bg-white px-2 py-1 rounded">{t(`enums.category.${courseType.category}`)}</span>
              <span className="text-xs font-semibold bg-white px-2 py-1 rounded">{languageName(courseType.language, locale)}</span>
            </div>
            <h1 className="font-poppins text-3xl font-bold text-dark-gray">{courseType.name}</h1>
            <p className="text-lg text-muted-foreground mt-1">{school.name}</p>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-green-700" />
              {t('common.lastConfirmed', { date: formatDate(intake.lastConfirmedAt, locale) })}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-soft p-6 grid sm:grid-cols-2 gap-5 text-sm">
            <div className="flex gap-3">
              <CalendarDays className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold">{t('market.course.dates')}</p>
                <p>
                  {formatDay(intake.startDate, locale)} – {formatDay(intake.endDate, locale)}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold">{t('market.course.schedule')}</p>
                <p>
                  {intake.weekdays.map((d) => t(`weekdays.short.${d}`)).join(', ')} · {intake.startTime}–{intake.endTime}
                </p>
                <p className="text-muted-foreground">{t('market.course.lessons', { count: courseType.lessonsPerWeek, minutes: courseType.lessonMinutes })}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold">{t('market.course.location')}</p>
                {online ? (
                  <p>{t('market.course.online')}</p>
                ) : (
                  <p>
                    {branch.address && (
                      <>
                        {branch.address}
                        <br />
                      </>
                    )}
                    {branch.postcode} {branch.cityName}
                  </p>
                )}
                {courseType.format === 'HYBRID' && <p className="text-muted-foreground">{t('enums.format.HYBRID')}</p>}
              </div>
            </div>
            <div className="flex gap-3">
              <Users className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold">{t('market.course.places')}</p>
                <p>
                  {mode === 'UNAVAILABLE'
                    ? t(`enums.unavailableReason.${reason}`)
                    : mode === 'ENQUIRY'
                      ? t('market.course.placesUnconfirmed')
                      : seatsLabel(t, available)}
                </p>
                {mode !== 'UNAVAILABLE' && (
                  <p className="text-muted-foreground">
                    {t('market.course.deadline', {
                      // Without an explicit deadline, booking closes as the start day begins.
                      date: intake.bookingDeadline
                        ? formatDateTime(bookingCloseTime(intake), locale)
                        : formatDay(new Date(intake.startDate.getTime() - 86_400_000), locale),
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>

          <section className="bg-white rounded-lg shadow-soft p-6">
            <h2 className="font-poppins font-bold text-lg mb-3">{t('market.course.price')}</h2>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <dt>{t('market.course.coursePrice')}</dt>
                <dd>{money(intake.priceCents)}</dd>
              </div>
              {intake.fees.map((fee) => (
                <div key={fee.id} className={`flex justify-between ${fee.compulsory ? '' : 'text-muted-foreground'}`}>
                  <dt>
                    {fee.label}
                    {!fee.compulsory && ` (${t('market.course.optionalFee')})`}
                  </dt>
                  <dd>{money(fee.amountCents)}</dd>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base border-t border-border pt-2 mt-2">
                <dt>{t('market.course.totalPrice')}</dt>
                <dd>{money(intake.totalPriceCents)}</dd>
              </div>
            </dl>
          </section>

          <section className="bg-white rounded-lg shadow-soft p-6 space-y-4">
            {courseType.description && <p className="whitespace-pre-wrap text-sm">{courseType.description}</p>}
            <div>
              <h2 className="font-poppins font-bold text-lg mb-2">{t('market.course.cancellation')}</h2>
              <p className="whitespace-pre-wrap text-sm">{courseType.cancellationTerms}</p>
            </div>
            {school.description && (
              <div>
                <h2 className="font-poppins font-bold text-lg mb-2">{t('market.course.aboutSchool')}</h2>
                <p className="whitespace-pre-wrap text-sm">{school.description}</p>
              </div>
            )}
          </section>

          {courseType.intakes.length > 0 && (
            <section>
              <h2 className="font-poppins font-bold text-lg mb-3">{t('market.course.otherDates')}</h2>
              <ul className="grid sm:grid-cols-2 gap-3">
                {courseType.intakes.map((other) => {
                  const otherMode = bookingMode({ school, courseType, intake: other, available: availability.get(other.id)?.available ?? 0, now })
                  return (
                    <li key={other.id}>
                      <Link href={`/courses/${other.id}`} className="block bg-white rounded-lg shadow-soft p-4 hover:shadow-premium text-sm">
                        <p className="font-semibold">{formatDay(other.startDate, locale)}</p>
                        <p className="text-muted-foreground">
                          {other.startTime}–{other.endTime} · {money(other.totalPriceCents)}
                        </p>
                        <div className="mt-2">
                          <ModeBadge mode={otherMode.mode} t={t} reason={otherMode.reason} />
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </article>

        <aside className="bg-white rounded-lg shadow-premium p-6 lg:sticky lg:top-20 space-y-4">
          <p className="font-poppins text-3xl font-bold text-dark-gray">{money(intake.totalPriceCents)}</p>
          <p className="text-xs text-muted-foreground -mt-3">{t('market.search.totalPrice')}</p>

          {mode === 'INSTANT' && (
            <>
              <h2 className="font-poppins font-bold text-lg">{t('market.course.bookTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('market.course.bookHint', { minutes: SEAT_HOLD_MINUTES })}</p>
              {existing ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{existing.status === 'CONFIRMED' ? t('market.course.alreadyBooked') : t('market.account.pending')}</p>
                  <Link href={existing.status === 'CONFIRMED' ? `/account/bookings/${existing.id}` : `/checkout/${existing.id}`} className={`${buttonClass} w-full`}>
                    {existing.status === 'CONFIRMED' ? t('market.course.viewBooking') : t('market.account.pending')}
                  </Link>
                </div>
              ) : actor ? (
                <ActionForm action={startBookingAction.bind(null, intake.id)} submitLabel={t('market.course.continue')} submitClassName="w-full py-3">
                  <Field label={t('market.course.yourName')}>
                    <input name="name" required defaultValue={actor.name} className={inputClass} />
                  </Field>
                  <Field label={`${t('common.phone')} (${t('common.optional')})`}>
                    <input name="phone" className={inputClass} />
                  </Field>
                </ActionForm>
              ) : (
                <div className="space-y-2">
                  <Link href={`/auth/login?callbackUrl=${encodeURIComponent(`/courses/${intake.id}`)}`} className={`${buttonClass} w-full py-3`}>
                    {t('market.course.loginToBook')}
                  </Link>
                  <Link href={`/auth/signup?callbackUrl=${encodeURIComponent(`/courses/${intake.id}`)}`} className="block text-center text-sm text-primary">
                    {t('market.course.noAccount')}
                  </Link>
                </div>
              )}
              <details className="text-sm border-t border-border pt-4">
                <summary className="cursor-pointer font-medium">{t('market.course.enquiryAlso')}</summary>
                <div className="mt-3">{enquiryForm}</div>
              </details>
            </>
          )}

          {mode === 'ENQUIRY' && (
            <>
              <h2 className="font-poppins font-bold text-lg">{t('market.course.enquiryTitle')}</h2>
              <p className="text-sm bg-blue-50 text-blue-900 rounded-lg p-3">{t('market.course.enquiryHint')}</p>
              {enquiryForm}
            </>
          )}

          {mode === 'UNAVAILABLE' && (
            <>
              <h2 className="font-poppins font-bold text-lg">{t('market.course.unavailableTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t(`enums.unavailableReason.${reason}`)}</p>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
