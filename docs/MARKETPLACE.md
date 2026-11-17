# NRW language-course marketplace

One Next.js app with three areas:

| Area | Path | Who |
|---|---|---|
| Student marketplace | `/`, `/courses`, `/courses/[intakeId]`, `/checkout/…`, `/account` | everyone / students |
| School management app | `/school/…` | school owners and staff (via `SchoolMembership`) |
| Internal admin | `/admin/…` | `PLATFORM_ADMIN` users |

The original Superb Sprachschule landing page now lives at `/superb`; its course list shows real intakes. The old admin pages (registrations, students, courses, settings) are still there under "Superb (legacy)".

## Data model

`School → Branch → CourseType → Intake → SeatHold / Booking` (see `prisma/schema.prisma`).

- **Seat capacity belongs to an `Intake`** (a dated run of a course).
- **Available seats** = `capacity − CONFIRMED bookings (marketplace + direct) − ACTIVE, unexpired holds`. They are always computed, never stored.
- **Money** is integer cents plus a currency.
- **School status**: `DISCOVERED → VERIFIED → PARTNER`, or `INACTIVE`. A database CHECK constraint makes `instantBookingEnabled` impossible unless `status = 'PARTNER'`.
- **AuditEvent** records changes to prices, capacity, course and intake status, bookings, payments, school status and commercial terms.

## How instant booking stays correct

Code: `lib/booking/inventory.ts`.

1. **"Continue to payment"** runs `createSeatHold`. It locks the intake row (`SELECT … FOR UPDATE`), recounts seats, applies the shared rules in `lib/booking/rules.ts`, and creates a `PENDING_PAYMENT` booking plus a 15-minute `SeatHold`. Concurrent attempts queue on the lock, so the last seat can only be held once.
2. **Payment** goes through Stripe Checkout, with one session per hold (idempotency key).
3. **Only the verified Stripe webhook confirms.** Each provider event id is recorded in the same transaction as its effect, and payments are unique by provider payment id. Redelivered or parallel notifications therefore never create a second booking or payment.
4. **If a paid booking can't be confirmed**, it is marked `FAILED_REFUNDED` and refunded in full automatically. Reasons: the seat went while the hold had lapsed, the intake was paused or closed, the school stopped taking instant bookings, or the amount paid doesn't match. Failed refund calls are retried by the housekeeping job and shown in admin.
5. **Direct enrolments, transfers, cancellations and capacity changes** take the same intake lock. Capacity can't be set below the seats already taken.
6. **Lapsed holds** stop counting the moment they expire. The cron job (`/api/cron/housekeeping`) tidies their status and closes the Stripe sessions.

## Local development

```bash
npm install
npm run db:local                       # throwaway Postgres on :54329 (keep it running)
export DATABASE_URL=postgresql://postgres:postgres@localhost:54329/marketplace
npx prisma migrate deploy
npm run db:seed:demo                   # fictional demo schools, courses, bookings
EMAIL_PROVIDER=mock PAYMENTS_PROVIDER=mock npm run dev
npm test                               # 40 business-rule tests (starts its own Postgres)
```

Demo logins (password `ChangeMe123!`, or `SEED_PASSWORD`):
- Admin: `ADMIN_EMAIL`.
- Student: `student@example.org`.
- School owners: `owner.deutschwerk@example.org` (instant booking on), `owner.sprachhaus@example.org` (instant booking off, pay-at-school), `owner.lingua@example.org`.

With `PAYMENTS_PROVIDER=mock`, "Pay" goes to `/checkout/mock`, which simulates the payment provider. That page is disabled in production unless `ALLOW_MOCK_PAYMENTS=true`.

> **If `next dev` keeps reloading pages or shows 404s for pages that exist:** stop the dev server, delete the `.next` folder and start again. The Turbopack dev disk cache is turned off in `next.config.mjs` (`turbopackFileSystemCacheForDev: false`) because it corrupted on this Windows setup. Also make sure nothing writes into the project folder while `next dev` runs; the local test databases live in the OS temp directory for this reason.

## Environment variables

| Variable | Needed | Purpose |
|---|---|---|
| `DATABASE_URL`, `AUTH_SECRET` | yes | as before |
| `APP_URL` | yes | absolute links in emails and payment redirects, e.g. `https://example.com` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | for payments | Stripe is used automatically when the key is set |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email | Resend is used automatically when the key is set; otherwise emails are only logged |
| `CRON_SECRET` | yes on Vercel | protects `/api/cron/housekeeping` |
| `NEXT_PUBLIC_PLATFORM_NAME` | optional | brand name shown to users (default "Superb") |
| `SEAT_HOLD_MINUTES`, `STALE_AFTER_DAYS` | optional | defaults 15 and 30 |
| `EMAIL_PROVIDER=mock`, `PAYMENTS_PROVIDER=mock` | dev/test | force the mocks |

## Deploying to the existing production database

The production database was created without migration history (`db push`). `0_init` is a baseline that matches it exactly. **Back up the database first.**

```bash
npx prisma migrate resolve --applied 0_init   # mark the baseline as already applied
npx prisma migrate deploy                     # applies 20260930000000_marketplace_foundation
npm run db:seed                               # languages, NRW cities, postcode centroids (no demo data)
npm run db:migrate-legacy                     # moves Superb courses/enrolments into the new model
```

The migration renames the role `ADMIN` to `PLATFORM_ADMIN` in place, so existing admins keep access (old session tokens are mapped too). Migrated legacy courses arrive as drafts with instant booking off. The school should check schedules, then submit them.

Then:

1. **Stripe webhook.** Add `https://<domain>/api/webhooks/payments` with the events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`.
2. **Postcode search.** Import NRW postcodes: download GeoNames `DE.zip` (CC BY 4.0), then run `npx tsx scripts/import-postcodes.ts DE.txt`. Until then, only the 11 city-centre postcodes are known.
3. **Cron.** `vercel.json` runs housekeeping every 10 minutes. Vercel Hobby only allows daily crons. Seat counts don't depend on the job; it only tidies up and retries refunds.

## Checking it by hand

1. **Admin** → Coverage → Import a CSV for Essen → review Duplicates → open a school → add a source → Mark as verified → Invite to claim profile.
2. **Claim.** Open the emailed `/claim/<token>` link (or check the server log when using the mock email), sign up and submit. **Admin** → Claims → Approve. The school becomes a partner, with instant booking still off.
3. **School app** → Branches → Courses → New course → add a dated intake → Submit. **Admin** → Approvals → Publish. **School** → School profile → enable instant booking.
4. **Direct enrolment.** School app → the intake → Enrol a student directly. The marketplace place count drops immediately.
5. **Marketplace** → `/courses` → course page shows "Book instantly" → pay. You get the reference and confirmation email, the school gets a notification, and both sides show the same remaining seats.
6. **Pause the intake** during a checkout. The payment is then refunded automatically and the booking shows "Not confirmed – refunded".

## Not built yet (deliberately)

- **Stripe Connect payouts to schools.** The platform currently collects card payments; reports separate course fees owed to schools from commission. Paying schools out still has to be done manually or via Connect.
- **Phase 3 items.** Subscription billing through Stripe (subscriptions are configured and tracked, not charged); richer reporting and CSV export beyond bookings; teacher scheduling, attendance, placement tests, reminders, invoices and accounting integrations.
- **Claim documents are stored in Postgres** (max. 3 MB). Move them to object storage when volume grows.
- **Translation of legacy pages.** All new screens are in German and English. The legacy Superb pages (old admin sections, `/dashboard`, `/register`) keep their original, mostly English-only texts.
