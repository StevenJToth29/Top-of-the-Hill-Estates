# Booking Approval System — Design Spec
**Date:** 2026-04-25  
**Status:** Approved for implementation

---

## Overview

When a guest completes checkout, their payment is authorized (held) but not charged. The guest is then required to submit photo ID and a current address for every person in their party, plus answer 5 screening questions. The booking remains in a pending approval state until an admin reviews the submission and approves or declines it within 24 hours. Payment is only captured on approval; the hold is released on decline or timeout.

---

## Decisions Made

| Decision | Choice |
|---|---|
| Payment timing | Stripe authorize-only (`capture_method: manual`); capture on approval |
| Application placement | Two-step: checkout first, then `/apply/[bookingId]` |
| Admin review action | Binary: Approve / Decline |
| AI ID validation | Hybrid: hard gate on quality (blurry/partial), soft flag on authenticity |
| Admin response deadline | 24 hours from application submission; auto-decline on timeout |
| Guest application deadline | 48 hours from checkout; auto-expire if not submitted |
| Architecture | Separate `booking_applications` + `guest_id_documents` tables |
| Admin UI placement | New "Applications" tab within existing Bookings page |
| Calendar blocking | Dates blocked during both `pending_docs` and `under_review` |

---

## Booking Status Flow

```
POST /api/bookings (capture_method: manual)
  ↓
[pending_docs]      ← Hold placed, awaiting guest application (48h window)
  ↓ guest submits
[under_review]      ← Application submitted, awaiting admin decision (24h window)
  ↓
[confirmed]         ← Admin approved → Stripe payment captured
[cancelled]         ← Admin declined → Stripe hold released
[expired]           ← 48h guest timeout OR 24h admin timeout → hold released
```

---

## Data Model

### New table: `booking_applications`

```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
booking_id          uuid NOT NULL REFERENCES bookings(id)
purpose_of_stay     text NOT NULL
traveling_from      text NOT NULL
shared_living_exp   text NOT NULL
house_rules_confirmed boolean NOT NULL DEFAULT false
additional_info     text
decision            text CHECK (decision IN ('approved', 'declined'))
decline_reason      text
submitted_at        timestamptz         -- null until guest hits Submit
reviewed_at         timestamptz
reviewed_by         uuid REFERENCES auth.users(id)
created_at          timestamptz NOT NULL DEFAULT now()
updated_at          timestamptz NOT NULL DEFAULT now()
```

### New table: `guest_id_documents`

```sql
id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
application_id        uuid NOT NULL REFERENCES booking_applications(id)
booking_id            uuid NOT NULL REFERENCES bookings(id)
guest_index           int NOT NULL        -- 1-based, up to booking.guest_count
guest_name            text NOT NULL
current_address       text NOT NULL
id_photo_url          text NOT NULL       -- Supabase Storage path
ai_quality_result     text CHECK (ai_quality_result IN ('pass', 'fail_blurry', 'fail_partial'))
ai_authenticity_flag  text CHECK (ai_authenticity_flag IN ('clear', 'flagged', 'uncertain'))
ai_validation_notes   text
ai_validated_at       timestamptz
created_at            timestamptz NOT NULL DEFAULT now()
```

### Changes to `bookings` table

- Extend `status` enum: add `'pending_docs'` and `'under_review'`
- Add column: `application_deadline timestamptz` — set when status moves to `under_review`; used by the 24h auto-decline cron

### Changes to availability check

- `isRoomAvailable()` (and any calendar query) must treat `pending_docs` and `under_review` as blocking statuses, same as `confirmed`

---

## Stripe Changes

### PaymentIntent creation (`POST /api/bookings`)

Add `capture_method: 'manual'` to the PaymentIntent creation call. No other checkout changes.

### New helpers (`lib/stripe.ts`)

```ts
capturePaymentIntent(paymentIntentId: string): Promise<void>
// Called on admin approval — captures the authorized hold

cancelPaymentIntent(paymentIntentId: string): Promise<void>
// Already exists for cancellations — reused for decline and timeout
```

---

## New Pages & Routes

### Guest-facing

| Path | Purpose |
|---|---|
| `/apply/[bookingId]` | Multi-step application form (ID uploads + screening questions) |

**Steps:**
1. Guest ID uploads — one block per guest (driven by `booking.guest_count`), each with name, address, ID photo upload + real-time AI validation
2. Screening questions — 5 questions (see below)
3. Review & submit — summary of all submissions before final send

**Progressive save:** A `booking_applications` row is created the moment the guest lands on `/apply/[bookingId]`. Each ID upload saves a `guest_id_documents` row immediately. Each question answer is auto-saved on blur. `submitted_at` remains `null` until the guest clicks the final Submit button. The form is fully resumable at any point.

**Screening questions:**
1. What is the purpose of your stay?
2. Where are you traveling from?
3. This is a room rental inside a shared house — do you have experience sharing common living spaces with other individuals?
4. Please confirm you have read all the house rules. *(checkbox + rules scroll)*
5. Additional information *(optional free text)*

### Admin-facing

| Path | Purpose |
|---|---|
| `/admin/(protected)/bookings` | Existing page — gets a new "Applications" tab |

**Applications tab** shows a queue table with columns: Guest, Room, Dates, Guests, AI Flags, Time Remaining, Status, Action. Rows are color-coded red when overdue.

**Review panel** (opens on "Review →" click, same pattern as existing `BookingDetailPanel`):
- Left: guest ID photos + AI assessments per guest; all 5 screening answers
- Right sidebar: live countdown timer, booking summary, Approve / Decline decision card
- Decline expands a reason textarea before confirming

---

## AI ID Validation

**Endpoint:** `POST /api/bookings/[id]/validate-id`

Called client-side immediately after each ID photo upload. Uses Claude's vision API.

**Hard gate (blocks form progression):**
- Image is blurry and text is unreadable
- ID is partially cropped / cut off at edges

Guest sees an inline error with a plain-language explanation and must re-upload before continuing.

**Soft flag (stored, shown to admin only):**
- Security features are unclear or unusual
- Document type or origin cannot be confidently identified
- Any other authenticity uncertainty

Admin sees Claude's reasoning note alongside the ID photo. The guest is not informed of soft flags.

**Result storage:** Both `ai_quality_result` and `ai_authenticity_flag` are written to `guest_id_documents` immediately after validation. `ai_validation_notes` stores Claude's full reasoning (1-2 sentences).

---

## Admin API Routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/applications` | List all `under_review` bookings with application data |
| `PATCH` | `/api/admin/bookings/[id]/application/review` | Approve or decline; body: `{ decision: 'approved' \| 'declined', decline_reason?: string }` |

**On Approve:**
1. Call `capturePaymentIntent(booking.stripe_payment_intent_id)`
2. Update `booking.status` → `confirmed`
3. Update `booking_applications.decision`, `reviewed_at`, `reviewed_by`
4. Queue `booking_approved` email to guest
5. Queue `admin_new_booking` email (existing) if not already sent
6. Seed reminder emails (existing `seedReminderEmails`)

**On Decline:**
1. Call `cancelPaymentIntent(booking.stripe_payment_intent_id)`
2. Update `booking.status` → `cancelled`
3. Update `booking_applications.decision`, `decline_reason`, `reviewed_at`, `reviewed_by`
4. Queue `booking_declined` email to guest with `{{decline_reason}}`

---

## Abandonment Handling

### Guest re-entry via Manage Booking

When a guest looks up their booking and status is `pending_docs`, a yellow banner is shown at the top of the manage booking page:

> **Your application is incomplete** — X hours remaining. [Resume Application →]

The banner also shows per-guest progress: which IDs passed, which need re-upload, whether questions are answered. The "Resume Application" button links to `/apply/[bookingId]`, which pre-populates all saved data.

### 48-hour expiry cron (new sweep)

The existing `expire-pending-bookings` cron gets a second sweep:

```
Find bookings WHERE status = 'pending_docs'
  AND created_at < now() - interval '48 hours'
→ cancelPaymentIntent
→ Update status to 'expired'
→ Queue application_expired email to guest
```

**Reminder emails before expiry** (queued at application creation):
- T+24h: `application_reminder_24h` — "24 hours left"
- T+36h: `application_reminder_12h` — "12 hours left — final warning"

---

## 24-hour Admin Review Deadline

`booking.application_deadline` is set to `submitted_at + 24 hours` when the guest submits.

### Deadline cron (new sweep, runs every 30 min)

```
Find bookings WHERE status = 'under_review'
  AND application_deadline < now()
→ cancelPaymentIntent
→ Update status to 'cancelled'
→ Update booking_applications.decision = 'declined' (system)
→ Queue booking_auto_declined email to guest
→ Queue admin_missed_deadline alert to admin
```

**Warning email before deadline:**
- T+23h: `admin_application_overdue` — "URGENT: 1 hour left to review [Guest Name]'s application"

---

## Email Templates (10 new)

### Guest templates (7)

| Key | Trigger | Subject |
|---|---|---|
| `application_needed` | Booking → `pending_docs` | "Complete your application — [Room] is held for you" |
| `application_reminder_24h` | Cron T+24h | "24 hours left to complete your booking application" |
| `application_reminder_12h` | Cron T+36h | "Final notice — 12 hours to complete your application" |
| `application_expired` | Cron T+48h | "Your booking hold has been released" |
| `booking_approved` | Admin approves | "Your booking is confirmed — [Room], [Dates]" |
| `booking_declined` | Admin declines | "Update on your booking request for [Room]" |
| `booking_auto_declined` | 24h admin timeout | "Your booking request was not reviewed in time" |

### Admin templates (3)

| Key | Trigger | Subject |
|---|---|---|
| `admin_application_submitted` | Guest submits application | "⚡ New application — [Guest] · [Room] · [Dates] — respond within 24h" |
| `admin_application_overdue` | Cron T+23h | "🚨 URGENT: 1 hour left to review [Guest]'s application" |
| `admin_missed_deadline` | Auto-decline fires | "Booking auto-declined — [Guest] · [Room] · [Dates] — no action was taken" |

### New email variable

`{{decline_reason}}` — populated from `booking_applications.decline_reason`. If empty, the `booking_declined` template renders a generic fallback: *"We are unable to accommodate your request at this time."*

---

## Public-Facing UI Updates

### BookingWidget (`components/public/BookingWidget.tsx`)

Add a notice below the CTA button:

> *Bookings require admin approval. You will not be charged until your booking is approved.*

### Checkout page

Add a notice in the payment section, above the submit button:

> *After submitting payment details, you'll be asked to provide ID verification for each guest and answer a few short questions. Your card will not be charged until your booking is approved.*

### Booking confirmation / manage booking page

When `status = 'pending_docs'`: show yellow "Complete your application" banner with progress and link.
When `status = 'under_review'`: show blue "Application submitted — under review" banner with expected response time.

---

## Public-Facing Awareness Updates

Any page that mentions booking or pricing should carry a short note that bookings are subject to approval. Specifically:
- Room detail pages (below the BookingWidget)
- The `/apply/[bookingId]` page header confirms "Your payment is on hold — not charged until approved"

---

## Out of Scope

- Re-submission flow (guest cannot re-submit a declined application — they would need to start a new booking)
- Stripe Identity / third-party verification (can be layered on later)
- Admin messaging thread with guests
- Liveness / selfie check
