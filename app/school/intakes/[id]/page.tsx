import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSchoolActor } from '@/lib/session'
import { getT } from '@/lib/i18n/server'
import { formatDateTime, formatDay, toDateTimeInput, toDayInput } from '@/lib/dates'
import { centsToInput, formatMoney } from '@/lib/money'
import { countSeats } from '@/lib/booking/inventory'
import { paymentSummary } from '@/lib/booking/manage'
import { archiveIntakeAction, confirmIntakesAction, directEnrolmentAction, setIntakeStatusAction, updateIntakeAction } from '@/app/actions/school'
import { ActionButton, ActionForm } from '@/components/app/action-form'
import { Card, Field, inputClass, PageHeader, secondaryButtonClass, Stat, StatusBadge, Table, Td } from '@/components/app/ui'
import { IntakeForm } from '@/components/school/intake-form'

export const metadata = { title: 'Intake | School app' }

export default async function SchoolIntakePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSchoolActor()
  const { id } = await params
  const { t, locale } = await getT()
  const intake = await prisma.intake.findUnique({
    where: { id },
    include: {
      fees: true,
      courseType: { include: { branch: true } },
      lastConfirmedBy: { select: { name: true } },
      bookings: {
        where: { status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } },
        orderBy: { createdAt: 'asc' },
        include: { payments: { include: { refunds: true } }, hold: true },
      },
    },
  })
  if (!intake || intake.schoolId !== actor.schoolId) notFound()

  const seats = await countSeats(prisma, intake.id)
  const available = Math.max(0, intake.capacity - seats.taken)
  const canCourses = actor.permissions.manageCourses && !intake.archivedAt
  const canBookings = actor.permissions.manageBookings && !intake.archivedAt
  const money = (cents: number) => formatMoney(cents, intake.currency, locale)
  const confirmed = intake.bookings.filter((b) => b.status === 'CONFIRMED')

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: `/school/courses/${intake.courseTypeId}`, label: intake.courseType.name }}
        title={`${intake.courseType.name} · ${formatDay(intake.startDate, locale)}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={intake.status} label={t(`enums.intakeStatus.${intake.status}`)} />
            <span>
              {intake.weekdays.map((d) => t(`weekdays.short.${d}`)).join(', ')} · {intake.startTime}–{intake.endTime} · {formatDay(intake.startDate, locale)} – {formatDay(intake.endDate, locale)}
            </span>
            <span className="text-xs">
              {t('school.intake.lastConfirmed', { date: formatDateTime(intake.lastConfirmedAt, locale) })} {intake.lastConfirmedBy && `· ${intake.lastConfirmedBy.name}`}
            </span>
          </span>
        }
        actions={
          canCourses && (
            <>
              <ActionButton action={confirmIntakesAction.bind(null, [intake.id])} successMessage={t('school.dashboard.confirmed_toast')}>
                {t('school.intake.confirmInfo')}
              </ActionButton>
              {intake.status === 'OPEN' && (
                <ActionButton action={setIntakeStatusAction.bind(null, intake.id, 'PAUSED')} confirmMessage={t('school.intake.pauseHint')} successMessage={t('common.saved')}>
                  {t('school.intake.pause')}
                </ActionButton>
              )}
              {intake.status !== 'OPEN' && (
                <ActionButton action={setIntakeStatusAction.bind(null, intake.id, 'OPEN')} variant="primary" successMessage={t('common.saved')}>
                  {t('school.intake.reopen')}
                </ActionButton>
              )}
              {intake.status !== 'CLOSED' && (
                <ActionButton action={setIntakeStatusAction.bind(null, intake.id, 'CLOSED')} variant="danger" confirmMessage={t('school.intake.pauseHint')} successMessage={t('common.saved')}>
                  {t('school.intake.close')}
                </ActionButton>
              )}
            </>
          )
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label={t('school.intake.capacity')} value={intake.capacity} />
        <Stat label={t('school.dashboard.sold')} value={seats.confirmed} />
        <Stat label={t('school.dashboard.held')} value={seats.held} />
        <Stat label={t('school.dashboard.available')} value={available} />
      </div>

      <Card
        title={`${t('school.intake.students')} (${confirmed.length})`}
        actions={
          <a href={`/api/school/intakes/${intake.id}/export`} className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}>
            {t('common.export')}
          </a>
        }
      >
        <Table head={[t('common.name'), t('common.email'), t('admin.bookings.channel'), t('common.status'), t('school.bookings.paid'), t('school.bookings.outstanding')]} empty={t('common.noResults')}>
          {intake.bookings.map((b) => {
            const { paid, outstanding } = paymentSummary(b)
            return (
              <tr key={b.id} className="hover:bg-cream">
                <Td>
                  <Link href={`/school/bookings/${b.id}`} className="font-medium hover:text-primary">
                    {b.studentName}
                  </Link>
                  <p className="text-xs text-muted-foreground font-mono">{b.reference}</p>
                </Td>
                <Td className="text-muted-foreground">{b.studentEmail}</Td>
                <Td>{t(`enums.bookingChannel.${b.channel}`)}</Td>
                <Td>
                  <StatusBadge status={b.status} label={t(`enums.bookingStatus.${b.status}`)} />
                  {b.cancellationRequestedAt && <p className="text-xs text-orange-700 mt-1">{t('school.bookings.cancellationRequested')}</p>}
                </Td>
                <Td>{money(paid)}</Td>
                <Td className={outstanding > 0 ? 'text-red-700 font-semibold' : ''}>{money(outstanding)}</Td>
              </tr>
            )
          })}
        </Table>
      </Card>

      <div className="grid xl:grid-cols-2 gap-6 items-start">
        {canBookings && (
          <Card title={t('school.intake.enrol')}>
            <p className="text-xs text-muted-foreground mb-3">{t('school.intake.enrolHint')}</p>
            {available === 0 || intake.status === 'CLOSED' ? (
              <p className="text-sm text-red-700">{intake.status === 'CLOSED' ? t('enums.unavailableReason.CLOSED') : t('errors.NO_SEATS')}</p>
            ) : (
              <ActionForm action={directEnrolmentAction.bind(null, intake.id)} submitLabel={t('school.intake.enrol')} successMessage={t('school.intake.enrolled')} resetOnSuccess>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label={`${t('school.intake.studentName')} *`}>
                    <input name="studentName" required className={inputClass} />
                  </Field>
                  <Field label={`${t('common.email')} *`}>
                    <input name="studentEmail" type="email" required className={inputClass} />
                  </Field>
                  <Field label={t('common.phone')}>
                    <input name="studentPhone" className={inputClass} />
                  </Field>
                  <Field label={t('school.intake.priceOverride')} hint={money(intake.totalPriceCents)}>
                    <input name="price" inputMode="decimal" className={inputClass} />
                  </Field>
                  <Field label={t('school.intake.paidNow')}>
                    <input name="paid" inputMode="decimal" defaultValue="0" className={inputClass} />
                  </Field>
                  <Field label={t('school.bookings.paymentMethod')}>
                    <select name="paymentMethod" className={inputClass}>
                      {(['BANK_TRANSFER', 'CASH', 'CARD', 'OTHER'] as const).map((m) => (
                        <option key={m} value={m}>
                          {t(`enums.paymentMethod.${m}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label={t('common.notes')}>
                  <input name="notes" className={inputClass} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="sendConfirmation" defaultChecked /> {t('school.intake.sendConfirmation')}
                </label>
              </ActionForm>
            )}
          </Card>
        )}

        {canCourses && (
          <Card title={t('common.edit')}>
            <IntakeForm
              action={updateIntakeAction.bind(null, intake.id)}
              submitLabel={t('common.save')}
              successMessage={t('common.saved')}
              initial={{
                startDate: toDayInput(intake.startDate),
                endDate: toDayInput(intake.endDate),
                weekdays: intake.weekdays,
                startTime: intake.startTime,
                endTime: intake.endTime,
                price: centsToInput(intake.priceCents),
                capacity: intake.capacity,
                bookingDeadline: toDateTimeInput(intake.bookingDeadline),
                instantBooking: intake.instantBooking,
                fees: intake.fees.map((f) => ({ label: f.label, amount: centsToInput(f.amountCents), compulsory: f.compulsory })),
              }}
            />
            {seats.confirmed === 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <ActionButton action={archiveIntakeAction.bind(null, intake.id)} variant="danger" confirmMessage={t('common.areYouSure')} redirectTo={`/school/courses/${intake.courseTypeId}`}>
                  {t('school.intake.archive')}
                </ActionButton>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
