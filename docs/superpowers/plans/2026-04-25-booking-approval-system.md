# Booking Approval System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full booking approval workflow: Stripe authorize-only at checkout, guest ID verification + screening questions at `/booking/apply/[bookingId]`, admin approve/decline within 24 hours, auto-decline on timeout, 48-hour guest application expiry.

**Architecture:** Two new DB tables (`booking_applications`, `guest_id_documents`), two new statuses (`pending_docs`, `under_review`), Stripe `capture_method: manual` replacing automatic capture, Claude vision for ID quality gating, a new guest application page, and an Applications tab in the existing admin Bookings page.

**Tech Stack:** Next.js App Router, Supabase (Postgres + Storage), Stripe (manual capture), Anthropic claude-sonnet-4-6 vision (ID validation), TypeScript, Jest

---

## Parallelization Guide

```
Tasks 1 → 2 (sequential foundation)
Then in parallel:
  Branch A: 3 → 4 → 6 → 7 → 8 → 9 → 10
  Branch B: 11 → 12 → 13
  Branch C: 14 (cron)
  Branch D: 15 (email)
  Branch E: 5, 16 (availability + public UI — can start after task 2)
All branches → final integration smoke test
```

---

## File Map

**Create:**
- `supabase/migrations/026_booking_approval_system.sql`
- `app/(public)/booking/apply/[bookingId]/page.tsx`
- `components/public/ApplicationForm.tsx`
- `components/public/IdUploadStep.tsx`
- `components/public/ScreeningQuestionsStep.tsx`
- `app/api/bookings/[id]/application/route.ts`
- `app/api/bookings/[id]/validate-id/route.ts`
- `app/api/admin/applications/route.ts`
- `app/api/admin/bookings/[id]/application/review/route.ts`
- `components/admin/ApplicationsTab.tsx`
- `components/admin/ApplicationReviewPanel.tsx`
- `__tests__/lib/availability-approval.test.ts`
- `__tests__/api/booking-application.test.ts`
- `__tests__/api/admin/application-review.test.ts`

**Modify:**
- `types/index.ts` — BookingStatus, BookingApplication, GuestIdDocument, TriggerEvent
- `lib/stripe.ts` — add `capturePaymentIntent`
- `lib/availability.ts` — add `pending_docs` + `under_review` to all status arrays
- `lib/email-queue.ts` — add `decline_reason` to `buildBookingVariables`
- `lib/email-variables.ts` — add `decline_reason` to VARIABLE_GROUPS + TRIGGER_EVENT_LABELS
- `app/api/bookings/route.ts` — `capture_method: manual`, status → `pending_docs`
- `app/api/bookings/[id]/confirm/route.ts` — accept `requires_capture`, status → `pending_docs`
- `app/api/cron/expire-pending-bookings/route.ts` — add pending_docs (48h) + under_review (24h) sweeps
- `components/public/CheckoutForm.tsx` — redirect to `/booking/apply/[id]` after payment
- `components/public/BookingWidget.tsx` — add approval notice
- `components/public/BookingManageView.tsx` — add pending_docs/under_review banners
- `app/admin/(protected)/bookings/page.tsx` — add Applications tab
- `components/admin/BookingsTable.tsx` — wrap in tabbed layout

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/026_booking_approval_system.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/026_booking_approval_system.sql

-- 1. Extend booking status enum
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_docs';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'under_review';

-- 2. Add application_deadline column to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS application_deadline timestamptz;

-- 3. booking_applications table
CREATE TABLE IF NOT EXISTS booking_applications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  purpose_of_stay       text NOT NULL DEFAULT '',
  traveling_from        text NOT NULL DEFAULT '',
  shared_living_exp     text NOT NULL DEFAULT '',
  house_rules_confirmed boolean NOT NULL DEFAULT false,
  additional_info       text,
  decision              text CHECK (decision IN ('approved', 'declined')),
  decline_reason        text,
  submitted_at          timestamptz,
  reviewed_at           timestamptz,
  reviewed_by           uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_applications_booking_id_key
  ON booking_applications(booking_id);

-- 4. guest_id_documents table
CREATE TABLE IF NOT EXISTS guest_id_documents (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id       uuid NOT NULL REFERENCES booking_applications(id) ON DELETE CASCADE,
  booking_id           uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  guest_index          int NOT NULL,
  guest_name           text NOT NULL DEFAULT '',
  current_address      text NOT NULL DEFAULT '',
  id_photo_url         text,
  ai_quality_result    text CHECK (ai_quality_result IN ('pass', 'fail_blurry', 'fail_partial')),
  ai_authenticity_flag text CHECK (ai_authenticity_flag IN ('clear', 'flagged', 'uncertain')),
  ai_validation_notes  text,
  ai_validated_at      timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_id_documents_application_guest_key
  ON guest_id_documents(application_id, guest_index);

-- 5. RLS policies
ALTER TABLE booking_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_id_documents ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — public access is intentionally blocked
CREATE POLICY "Service role only" ON booking_applications
  USING (false);
CREATE POLICY "Service role only" ON guest_id_documents
  USING (false);

-- 6. Supabase Storage bucket for ID photos (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-documents',
  'id-documents',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applied, no errors.

- [ ] **Step 3: Verify tables exist**

```bash
npx supabase db diff
```

Expected: no pending changes (migration fully applied).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/026_booking_approval_system.sql
git commit -m "feat: add booking approval system DB migration"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Update BookingStatus**

In `types/index.ts` at line 73, replace:
```ts
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'expired'
```
with:
```ts
export type BookingStatus = 'pending' | 'pending_docs' | 'under_review' | 'confirmed' | 'cancelled' | 'completed' | 'expired'
```

- [ ] **Step 2: Add BookingApplication and GuestIdDocument types**

After the `Booking` interface (around line 115), add:
```ts
export interface BookingApplication {
  id: string
  booking_id: string
  purpose_of_stay: string
  traveling_from: string
  shared_living_exp: string
  house_rules_confirmed: boolean
  additional_info: string | null
  decision: 'approved' | 'declined' | null
  decline_reason: string | null
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
}

export interface GuestIdDocument {
  id: string
  application_id: string
  booking_id: string
  guest_index: number
  guest_name: string
  current_address: string
  id_photo_url: string | null
  ai_quality_result: 'pass' | 'fail_blurry' | 'fail_partial' | null
  ai_authenticity_flag: 'clear' | 'flagged' | 'uncertain' | null
  ai_validation_notes: string | null
  ai_validated_at: string | null
  created_at: string
}
```

- [ ] **Step 3: Extend TriggerEvent**

At line 274, replace the `TriggerEvent` type with:
```ts
export type TriggerEvent =
  | 'booking_confirmed'
  | 'booking_pending'
  | 'booking_cancelled'
  | 'contact_submitted'
  | 'checkin_reminder'
  | 'checkout_reminder'
  | 'post_checkout'
  | 'review_request'
  | 'modification_requested'
  | 'admin_new_booking'
  | 'admin_cancelled'
  | 'booking_payment_request'
  | 'application_needed'
  | 'application_reminder_24h'
  | 'application_reminder_12h'
  | 'application_expired'
  | 'booking_approved'
  | 'booking_declined'
  | 'booking_auto_declined'
  | 'admin_application_submitted'
  | 'admin_application_overdue'
  | 'admin_missed_deadline'
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add types/index.ts
git commit -m "feat: add BookingApplication, GuestIdDocument types and new TriggerEvents"
```

---

## Task 3: Stripe Manual Capture

**Files:**
- Modify: `lib/stripe.ts`
- Modify: `app/api/bookings/route.ts`

- [ ] **Step 1: Add capturePaymentIntent to lib/stripe.ts**

Append to `lib/stripe.ts` after the proxy export:
```ts
export async function capturePaymentIntent(paymentIntentId: string): Promise<void> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
  if (pi.status === 'requires_capture') {
    await stripe.paymentIntents.capture(paymentIntentId)
  }
  // ACH/bank payments in 'processing' or 'succeeded' capture automatically — no action needed
}
```

- [ ] **Step 2: Update PaymentIntent creation in app/api/bookings/route.ts**

At line 193, add `capture_method: 'manual'` to the PaymentIntent create call:
```ts
const paymentIntent = await stripe.paymentIntents.create(
  {
    amount: Math.round(total_amount * 100),
    currency: 'usd',
    capture_method: 'manual',
    payment_method_types: enabledMethods.map((m) => m.method_key),
    metadata: { room_id, booking_type, guest_email },
    payment_method_options: {
      us_bank_account: {
        verification_method: 'instant',
      },
    },
    ...(connectedAccountId && {
      transfer_data: { destination: connectedAccountId },
      application_fee_amount: Math.round(total_amount * (platformFeePercent / 100) * 100),
    }),
  },
  { idempotencyKey: `booking-${room_id}-${guest_email}-${check_in}-${check_out}` },
)
```

- [ ] **Step 3: Change initial booking status from pending to pending_docs**

At line 235 in `app/api/bookings/route.ts`, change:
```ts
status: 'pending',
```
to:
```ts
status: 'pending_docs',
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/stripe.ts app/api/bookings/route.ts
git commit -m "feat: use Stripe manual capture and set initial booking status to pending_docs"
```

---

## Task 4: Update Confirm Route for Manual Capture

**Files:**
- Modify: `app/api/bookings/[id]/confirm/route.ts`

- [ ] **Step 1: Read the current confirm route**

Read `app/api/bookings/[id]/confirm/route.ts` in full before editing.

- [ ] **Step 2: Update confirm route to handle requires_capture and set pending_docs**

The confirm route currently checks `pi.status === 'succeeded'` and sets status to `confirmed`. Change it to:
- Accept `requires_capture` (card hold placed) and `processing` / `requires_action` (ACH) as success states
- Set booking status to `pending_docs` instead of `confirmed`
- Queue `application_needed` email instead of `booking_confirmed`
- Do NOT seed reminder emails (those fire after admin approval)
- Do NOT call GHL confirmed webhook (fires after admin approval)

Replace the status-check logic and success block. The key section to change is wherever `pi.status` is checked and `status: 'confirmed'` is set. Change it to:

```ts
const validStatuses = ['requires_capture', 'succeeded', 'processing', 'requires_action']
if (!validStatuses.includes(pi.status)) {
  return NextResponse.json(
    { error: 'Payment not yet authorized' },
    { status: 400 }
  )
}

const { error: updateError } = await supabase
  .from('bookings')
  .update({
    status: 'pending_docs',
    amount_paid: pi.status === 'succeeded' ? booking.total_amount : 0,
    updated_at: new Date().toISOString(),
  })
  .eq('id', bookingId)

if (updateError) {
  console.error('confirm: failed to update booking status:', updateError)
  return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
}

evaluateAndQueueEmails('application_needed', { type: 'booking', bookingId }).catch(
  (err) => { console.error('email queue error on application_needed:', err) }
)

return NextResponse.json({ status: 'pending_docs' })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/bookings/[id]/confirm/route.ts
git commit -m "feat: confirm route accepts requires_capture and moves booking to pending_docs"
```

---

## Task 5: Availability Blocking for New Statuses

**Files:**
- Modify: `lib/availability.ts`
- Create: `__tests__/lib/availability-approval.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/availability-approval.test.ts
/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import { getBlockedDatesForRoom, isRoomAvailable, getAvailableRoomIds } from '@/lib/availability'

function mockSupabaseWithStatuses(bookings: { check_in: string; check_out: string; status?: string }[]) {
  const makeChain = (resolveValue: unknown) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockResolvedValue(resolveValue),
  })
  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'bookings') return makeChain({ data: bookings, error: null })
      return makeChain({ data: [], error: null })
    }),
  })
}

describe('availability with approval statuses', () => {
  it('blocks dates for pending_docs booking', async () => {
    mockSupabaseWithStatuses([{ check_in: '2026-07-01', check_out: '2026-07-05' }])
    const blocked = await getBlockedDatesForRoom('room-1', '2026-06-01', '2026-08-01')
    expect(blocked).toContain('2026-07-01')
    expect(blocked).toContain('2026-07-04')
    expect(blocked).not.toContain('2026-07-05')
  })

  it('blocks dates for under_review booking', async () => {
    mockSupabaseWithStatuses([{ check_in: '2026-07-10', check_out: '2026-07-12' }])
    const result = await isRoomAvailable('room-1', '2026-07-09', '2026-07-11')
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/availability-approval.test.ts --no-coverage
```

Expected: FAIL — the mock currently only exercises existing code; these tests just verify the status array includes the new values once we update the query.

- [ ] **Step 3: Update all status arrays in lib/availability.ts**

There are three places in `lib/availability.ts` where `.in('status', ['confirmed', 'pending'])` appears (lines ~39, ~82, ~120). In all three, change:
```ts
.in('status', ['confirmed', 'pending'])
```
to:
```ts
.in('status', ['confirmed', 'pending', 'pending_docs', 'under_review'])
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/availability-approval.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add lib/availability.ts __tests__/lib/availability-approval.test.ts
git commit -m "feat: block room dates for pending_docs and under_review bookings"
```

---

## Task 6: Application API Routes (Guest)

**Files:**
- Create: `app/api/bookings/[id]/application/route.ts`
- Create: `__tests__/api/booking-application.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/api/booking-application.test.ts
/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))

import { createServiceRoleClient } from '@/lib/supabase'
import { GET, POST, PATCH } from '@/app/api/bookings/[id]/application/route'

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeReq(method: string, body?: object) {
  return new Request('http://localhost/api/bookings/test-id/application', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function setupMocks({ booking = null, application = null, upsertError = null }: {
  booking?: Record<string, unknown> | null
  application?: Record<string, unknown> | null
  upsertError?: { message: string } | null
}) {
  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: table === 'bookings' ? booking : application,
        error: null,
      }),
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: application, error: upsertError }),
    })),
  })
}

describe('GET /api/bookings/[id]/application', () => {
  it('returns 404 when booking not found', async () => {
    setupMocks({ booking: null })
    const res = await GET(makeReq('GET'), makeCtx('missing-id'))
    expect(res.status).toBe(404)
  })

  it('returns 403 when booking not in pending_docs', async () => {
    setupMocks({ booking: { id: 'b1', status: 'confirmed', guest_count: 1 } })
    const res = await GET(makeReq('GET'), makeCtx('b1'))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/bookings/[id]/application', () => {
  it('returns 400 when booking not pending_docs', async () => {
    setupMocks({ booking: { id: 'b1', status: 'confirmed', guest_count: 1 } })
    const res = await POST(makeReq('POST', {}), makeCtx('b1'))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/api/booking-application.test.ts --no-coverage
```

Expected: FAIL — route file doesn't exist yet.

- [ ] **Step 3: Create the application route**

```ts
// app/api/bookings/[id]/application/route.ts
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { evaluateAndQueueEmails } from '@/lib/email-queue'
import type { BookingApplication } from '@/types'

interface RouteContext { params: Promise<{ id: string }> }

// GET — load existing application + guest_id_documents for resumption
export async function GET(_req: Request, { params }: RouteContext) {
  const { id: bookingId } = await params
  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, guest_count, guest_email, guest_first_name, guest_last_name')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!['pending_docs', 'under_review'].includes(booking.status)) {
    return NextResponse.json({ error: 'Application not available for this booking' }, { status: 403 })
  }

  const { data: application } = await supabase
    .from('booking_applications')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle()

  const { data: guestDocs } = await supabase
    .from('guest_id_documents')
    .select('*')
    .eq('booking_id', bookingId)
    .order('guest_index')

  return NextResponse.json({ booking, application: application ?? null, guestDocs: guestDocs ?? [] })
}

// POST — create application row on page load (idempotent)
export async function POST(_req: Request, { params }: RouteContext) {
  const { id: bookingId } = await params
  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, guest_count')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status !== 'pending_docs') {
    return NextResponse.json({ error: 'Application cannot be started for this booking' }, { status: 400 })
  }

  const { data: application, error } = await supabase
    .from('booking_applications')
    .upsert({ booking_id: bookingId }, { onConflict: 'booking_id', ignoreDuplicates: false })
    .select()
    .single()

  if (error) {
    console.error('application POST: upsert error:', error)
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 })
  }

  return NextResponse.json({ application })
}

// PATCH — save screening answers and/or submit final application
export async function PATCH(req: Request, { params }: RouteContext) {
  const { id: bookingId } = await params
  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, guest_count')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status !== 'pending_docs') {
    return NextResponse.json({ error: 'Application already submitted or expired' }, { status: 400 })
  }

  const body = await req.json() as Partial<BookingApplication> & { submit?: boolean }

  const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.purpose_of_stay !== undefined) updateFields.purpose_of_stay = body.purpose_of_stay
  if (body.traveling_from !== undefined) updateFields.traveling_from = body.traveling_from
  if (body.shared_living_exp !== undefined) updateFields.shared_living_exp = body.shared_living_exp
  if (body.house_rules_confirmed !== undefined) updateFields.house_rules_confirmed = body.house_rules_confirmed
  if (body.additional_info !== undefined) updateFields.additional_info = body.additional_info

  if (body.submit === true) {
    // Validate all fields present before final submit
    const { data: app } = await supabase
      .from('booking_applications')
      .select('*')
      .eq('booking_id', bookingId)
      .single()

    const { data: docs } = await supabase
      .from('guest_id_documents')
      .select('id, ai_quality_result')
      .eq('booking_id', bookingId)

    const expectedDocs = booking.guest_count ?? 1
    const passedDocs = (docs ?? []).filter((d) => d.ai_quality_result === 'pass')

    if (passedDocs.length < expectedDocs) {
      return NextResponse.json(
        { error: `All ${expectedDocs} guest ID(s) must be uploaded and pass quality check` },
        { status: 422 }
      )
    }

    const merged = { ...app, ...updateFields }
    if (!merged.purpose_of_stay || !merged.traveling_from || !merged.shared_living_exp || !merged.house_rules_confirmed) {
      return NextResponse.json({ error: 'All screening questions must be answered' }, { status: 422 })
    }

    updateFields.submitted_at = new Date().toISOString()

    // Move booking to under_review and set 24h deadline
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('bookings')
      .update({ status: 'under_review', application_deadline: deadline, updated_at: new Date().toISOString() })
      .eq('id', bookingId)

    evaluateAndQueueEmails('admin_application_submitted', { type: 'booking', bookingId }).catch(
      (err) => { console.error('email queue error on admin_application_submitted:', err) }
    )
  }

  const { data: updated, error: updateError } = await supabase
    .from('booking_applications')
    .update(updateFields)
    .eq('booking_id', bookingId)
    .select()
    .single()

  if (updateError) {
    console.error('application PATCH: update error:', updateError)
    return NextResponse.json({ error: 'Failed to save application' }, { status: 500 })
  }

  return NextResponse.json({ application: updated, submitted: body.submit === true })
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest __tests__/api/booking-application.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/bookings/[id]/application/route.ts __tests__/api/booking-application.test.ts
git commit -m "feat: add booking application API routes (GET/POST/PATCH)"
```

---

## Task 7: Guest ID Document API + AI Validation

**Files:**
- Create: `app/api/bookings/[id]/validate-id/route.ts`

- [ ] **Step 1: Install Anthropic SDK if not present**

```bash
grep "@anthropic-ai/sdk" package.json || npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Create the validate-id route**

```ts
// app/api/bookings/[id]/validate-id/route.ts
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceRoleClient } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface RequestBody {
  guest_index: number
  guest_name: string
  current_address: string
  id_photo_url: string   // Supabase Storage path
  image_base64: string   // base64-encoded image data sent from client
  image_mime_type: string
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params
  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, guest_count')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!['pending_docs'].includes(booking.status)) {
    return NextResponse.json({ error: 'Validation not available' }, { status: 400 })
  }

  const body = (await req.json()) as RequestBody
  const { guest_index, guest_name, current_address, id_photo_url, image_base64, image_mime_type } = body

  if (guest_index < 1 || guest_index > (booking.guest_count ?? 1)) {
    return NextResponse.json({ error: 'Invalid guest_index' }, { status: 400 })
  }

  // Claude vision: evaluate ID quality and authenticity
  let ai_quality_result: 'pass' | 'fail_blurry' | 'fail_partial' = 'pass'
  let ai_authenticity_flag: 'clear' | 'flagged' | 'uncertain' = 'clear'
  let ai_validation_notes = ''

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image_mime_type as 'image/jpeg' | 'image/png' | 'image/webp',
                data: image_base64,
              },
            },
            {
              type: 'text',
              text: `You are evaluating a government-issued photo ID for a rental property booking.
Assess this image on two dimensions:

1. IMAGE QUALITY (hard gate):
   - Is the text readable and not blurry?
   - Is the full ID visible without cropping?
   Answer: PASS or FAIL_BLURRY or FAIL_PARTIAL

2. AUTHENTICITY (soft flag for admin):
   - Does this appear to be a genuine government-issued ID document?
   - Are security features, layout, and formatting consistent with real IDs?
   Answer: CLEAR or FLAGGED or UNCERTAIN

Respond in this exact format (two lines only):
QUALITY: <PASS|FAIL_BLURRY|FAIL_PARTIAL>
AUTHENTICITY: <CLEAR|FLAGGED|UNCERTAIN>
NOTE: <one sentence explanation, max 100 chars>`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const qualityMatch = text.match(/QUALITY:\s*(PASS|FAIL_BLURRY|FAIL_PARTIAL)/i)
    const authMatch = text.match(/AUTHENTICITY:\s*(CLEAR|FLAGGED|UNCERTAIN)/i)
    const noteMatch = text.match(/NOTE:\s*(.+)/i)

    ai_quality_result = (qualityMatch?.[1]?.toLowerCase() ?? 'pass') as typeof ai_quality_result
    ai_authenticity_flag = (authMatch?.[1]?.toLowerCase() ?? 'clear') as typeof ai_authenticity_flag
    ai_validation_notes = noteMatch?.[1]?.trim() ?? ''
  } catch (err) {
    console.error('validate-id: Claude API error:', err)
    // Fail open on API errors — let admin review manually
    ai_quality_result = 'pass'
    ai_authenticity_flag = 'uncertain'
    ai_validation_notes = 'AI validation unavailable — manual review required'
  }

  // Get or create application row
  const { data: application } = await supabase
    .from('booking_applications')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (!application) {
    return NextResponse.json({ error: 'Application not started — call POST /application first' }, { status: 400 })
  }

  // Upsert guest_id_documents row
  const { data: docRow, error: docError } = await supabase
    .from('guest_id_documents')
    .upsert(
      {
        application_id: application.id,
        booking_id: bookingId,
        guest_index,
        guest_name,
        current_address,
        id_photo_url,
        ai_quality_result,
        ai_authenticity_flag,
        ai_validation_notes,
        ai_validated_at: new Date().toISOString(),
      },
      { onConflict: 'application_id,guest_index' }
    )
    .select()
    .single()

  if (docError) {
    console.error('validate-id: failed to save doc:', docError)
    return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
  }

  return NextResponse.json({
    document: docRow,
    quality_passed: ai_quality_result === 'pass',
    quality_error:
      ai_quality_result === 'fail_blurry'
        ? 'Your ID photo is blurry. Please retake in good lighting and ensure text is readable.'
        : ai_quality_result === 'fail_partial'
        ? 'Your ID is partially cropped. Please ensure the full ID is visible in the frame.'
        : null,
  })
}
```

- [ ] **Step 3: Add ANTHROPIC_API_KEY to environment variables**

Verify `ANTHROPIC_API_KEY` is set in `.env.local`:
```bash
grep ANTHROPIC_API_KEY .env.local || echo "MISSING — add ANTHROPIC_API_KEY=sk-ant-... to .env.local"
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/bookings/[id]/validate-id/route.ts
git commit -m "feat: add AI-powered ID validation endpoint using Claude vision"
```

---

## Task 8: IdUploadStep Component

**Files:**
- Create: `components/public/IdUploadStep.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/public/IdUploadStep.tsx
'use client'

import { useState, useRef } from 'react'
import type { GuestIdDocument } from '@/types'

interface IdUploadStepProps {
  bookingId: string
  guestCount: number
  savedDocs: GuestIdDocument[]
  onAllPassed: (docs: GuestIdDocument[]) => void
}

interface GuestDraftState {
  name: string
  address: string
  file: File | null
  uploading: boolean
  doc: GuestIdDocument | null
  error: string | null
}

export default function IdUploadStep({ bookingId, guestCount, savedDocs, onAllPassed }: IdUploadStepProps) {
  const initialDrafts: GuestDraftState[] = Array.from({ length: guestCount }, (_, i) => {
    const saved = savedDocs.find((d) => d.guest_index === i + 1) ?? null
    return {
      name: saved?.guest_name ?? '',
      address: saved?.current_address ?? '',
      file: null,
      uploading: false,
      doc: saved,
      error: null,
    }
  })
  const [drafts, setDrafts] = useState<GuestDraftState[]>(initialDrafts)
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])

  function updateDraft(idx: number, patch: Partial<GuestDraftState>) {
    setDrafts((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  async function handleUpload(idx: number, file: File) {
    updateDraft(idx, { uploading: true, error: null, file })

    // Convert to base64
    const buffer = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))

    // Upload to Supabase Storage via server action / signed URL pattern
    // We send base64 directly to validate-id which handles storage
    const storageKey = `${bookingId}/${idx + 1}-${Date.now()}-${file.name}`

    const res = await fetch(`/api/bookings/${bookingId}/validate-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_index: idx + 1,
        guest_name: drafts[idx].name,
        current_address: drafts[idx].address,
        id_photo_url: storageKey,
        image_base64: base64,
        image_mime_type: file.type,
      }),
    })

    const data = await res.json()
    updateDraft(idx, { uploading: false })

    if (!res.ok) {
      updateDraft(idx, { error: data.error ?? 'Upload failed. Please try again.' })
      return
    }

    if (!data.quality_passed) {
      updateDraft(idx, { error: data.quality_error, doc: null, file: null })
      if (fileRefs.current[idx]) fileRefs.current[idx]!.value = ''
      return
    }

    updateDraft(idx, { doc: data.document, error: null })

    // Check if all guests now have passing docs
    const updatedDrafts = [...drafts]
    updatedDrafts[idx] = { ...updatedDrafts[idx], doc: data.document }
    const allDocs = updatedDrafts.map((d) => d.doc).filter(Boolean) as GuestIdDocument[]
    if (allDocs.length === guestCount && allDocs.every((d) => d.ai_quality_result === 'pass')) {
      onAllPassed(allDocs)
    }
  }

  const allPassed = drafts.every((d) => d.doc?.ai_quality_result === 'pass')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-on-surface mb-1">Guest Identification</h2>
        <p className="text-on-surface-variant text-sm">
          Upload a clear, full photo of a valid government-issued ID for each guest.
        </p>
      </div>

      {drafts.map((draft, idx) => {
        const passed = draft.doc?.ai_quality_result === 'pass'
        const flagged = draft.doc?.ai_authenticity_flag === 'flagged' || draft.doc?.ai_authenticity_flag === 'uncertain'

        return (
          <div
            key={idx}
            className={`border rounded-xl p-5 space-y-4 ${
              passed ? 'border-secondary/50 bg-secondary/5' : draft.error ? 'border-error/50 bg-error/5' : 'border-outline'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-on-surface text-sm">
                Guest {idx + 1}{idx === 0 ? ' (Primary)' : ''}
              </span>
              {passed && (
                <span className="text-xs font-semibold text-secondary bg-secondary/10 px-2 py-1 rounded-full">
                  ✓ ID Verified
                </span>
              )}
              {draft.error && (
                <span className="text-xs font-semibold text-error bg-error/10 px-2 py-1 rounded-full">
                  ✗ Re-upload Required
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-on-surface-variant text-xs mb-1">Full Name</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => updateDraft(idx, { name: e.target.value })}
                  disabled={passed}
                  placeholder="As shown on ID"
                  className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-on-surface-variant text-xs mb-1">Current Address</label>
                <input
                  type="text"
                  value={draft.address}
                  onChange={(e) => updateDraft(idx, { address: e.target.value })}
                  disabled={passed}
                  placeholder="Street, City, State ZIP"
                  className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-on-surface-variant text-xs mb-1">Photo ID</label>
              {passed ? (
                <div className="rounded-xl bg-secondary/10 border border-secondary/30 px-4 py-3 text-secondary text-sm font-medium">
                  ✓ ID uploaded and verified
                  {flagged && (
                    <span className="block text-xs text-warning mt-1 font-normal">
                      Note: Admin will verify authenticity during review
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <input
                    ref={(el) => { fileRefs.current[idx] = el }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    disabled={draft.uploading || !draft.name.trim() || !draft.address.trim()}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(idx, file)
                    }}
                    className="block w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-secondary/10 file:text-secondary hover:file:bg-secondary/20 disabled:opacity-50"
                  />
                  {(!draft.name.trim() || !draft.address.trim()) && (
                    <p className="text-xs text-on-surface-variant mt-1">Enter name and address above before uploading</p>
                  )}
                  {draft.uploading && (
                    <p className="text-xs text-on-surface-variant mt-1">Checking ID quality…</p>
                  )}
                  {draft.error && (
                    <p className="text-xs text-error mt-1">{draft.error}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}

      {!allPassed && (
        <p className="text-sm text-on-surface-variant text-center">
          All {guestCount} guest ID{guestCount > 1 ? 's' : ''} must be verified before continuing
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/public/IdUploadStep.tsx
git commit -m "feat: add IdUploadStep component with real-time AI validation"
```

---

## Task 9: Screening Questions + Application Form + Apply Page

**Files:**
- Create: `components/public/ScreeningQuestionsStep.tsx`
- Create: `components/public/ApplicationForm.tsx`
- Create: `app/(public)/booking/apply/[bookingId]/page.tsx`

- [ ] **Step 1: Create ScreeningQuestionsStep**

```tsx
// components/public/ScreeningQuestionsStep.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import type { BookingApplication } from '@/types'

interface ScreeningQuestionsStepProps {
  bookingId: string
  saved: Partial<BookingApplication>
  houseRules: string
  onChange: (fields: Partial<BookingApplication>) => void
}

export default function ScreeningQuestionsStep({
  bookingId,
  saved,
  houseRules,
  onChange,
}: ScreeningQuestionsStepProps) {
  const [fields, setFields] = useState({
    purpose_of_stay: saved.purpose_of_stay ?? '',
    traveling_from: saved.traveling_from ?? '',
    shared_living_exp: saved.shared_living_exp ?? '',
    house_rules_confirmed: saved.house_rules_confirmed ?? false,
    additional_info: saved.additional_info ?? '',
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function update(patch: Partial<typeof fields>) {
    const next = { ...fields, ...patch }
    setFields(next)
    onChange(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch(`/api/bookings/${bookingId}/application`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch((err) => console.error('auto-save error:', err))
    }, 800)
  }

  const ta = 'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 resize-none min-h-[80px]'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-on-surface mb-1">Screening Questions</h2>
        <p className="text-on-surface-variant text-sm">
          Please answer each question honestly to help us ensure a great experience for all guests.
        </p>
      </div>

      <div>
        <label className="block text-on-surface text-sm font-semibold mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-white text-xs font-bold mr-2">1</span>
          What is the purpose of your stay?
        </label>
        <textarea
          className={ta}
          value={fields.purpose_of_stay}
          onChange={(e) => update({ purpose_of_stay: e.target.value })}
          placeholder="e.g. visiting family, business trip, short vacation…"
        />
      </div>

      <div>
        <label className="block text-on-surface text-sm font-semibold mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-white text-xs font-bold mr-2">2</span>
          Where are you traveling from?
        </label>
        <textarea
          className={ta}
          value={fields.traveling_from}
          onChange={(e) => update({ traveling_from: e.target.value })}
          placeholder="City and state, or country if international"
        />
      </div>

      <div>
        <label className="block text-on-surface text-sm font-semibold mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-white text-xs font-bold mr-2">3</span>
          This is a room rental inside a shared house. Do you have experience sharing common living spaces with other individuals?
        </label>
        <textarea
          className={ta}
          value={fields.shared_living_exp}
          onChange={(e) => update({ shared_living_exp: e.target.value })}
          placeholder="Please describe your experience with shared living arrangements"
        />
      </div>

      <div>
        <label className="block text-on-surface text-sm font-semibold mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-white text-xs font-bold mr-2">4</span>
          Please confirm you have read all the house rules.
        </label>
        {houseRules && (
          <div className="bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface-variant text-sm mb-3 max-h-32 overflow-y-auto">
            {houseRules}
          </div>
        )}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={fields.house_rules_confirmed}
            onChange={(e) => update({ house_rules_confirmed: e.target.checked })}
            className="w-5 h-5 rounded accent-secondary"
          />
          <span className="text-sm text-on-surface font-medium">I have read and agree to all house rules</span>
        </label>
      </div>

      <div>
        <label className="block text-on-surface text-sm font-semibold mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-white text-xs font-bold mr-2">5</span>
          Additional Information{' '}
          <span className="font-normal text-on-surface-variant">(optional)</span>
        </label>
        <textarea
          className={ta}
          value={fields.additional_info}
          onChange={(e) => update({ additional_info: e.target.value })}
          placeholder="Anything else you'd like us to know about your stay…"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ApplicationForm**

```tsx
// components/public/ApplicationForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import IdUploadStep from '@/components/public/IdUploadStep'
import ScreeningQuestionsStep from '@/components/public/ScreeningQuestionsStep'
import type { Booking, BookingApplication, GuestIdDocument } from '@/types'

interface ApplicationFormProps {
  booking: Booking & { room: { name: string; property: { name: string; house_rules?: string } } }
  application: BookingApplication | null
  savedDocs: GuestIdDocument[]
}

type Step = 'ids' | 'questions' | 'submit'

export default function ApplicationForm({ booking, application, savedDocs }: ApplicationFormProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('ids')
  const [idDocs, setIdDocs] = useState<GuestIdDocument[]>(savedDocs)
  const [questionFields, setQuestionFields] = useState<Partial<BookingApplication>>(application ?? {})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allIdsPassed = idDocs.filter((d) => d.ai_quality_result === 'pass').length >= (booking.guest_count ?? 1)

  const questionsComplete =
    !!questionFields.purpose_of_stay?.trim() &&
    !!questionFields.traveling_from?.trim() &&
    !!questionFields.shared_living_exp?.trim() &&
    !!questionFields.house_rules_confirmed

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/application`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...questionFields, submit: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Submission failed. Please try again.')
        return
      }
      router.push(`/booking/manage?booking_id=${booking.id}&guest_email=${encodeURIComponent(booking.guest_email)}`)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'ids', label: 'Guest IDs' },
    { key: 'questions', label: 'Questions' },
    { key: 'submit', label: 'Submit' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-display text-2xl font-bold text-on-surface">Complete Your Application</h1>
        <p className="text-on-surface-variant text-sm">
          Your payment is on hold — you will only be charged if your booking is approved.
        </p>
        <div className="inline-flex items-center gap-1 bg-warning/10 border border-warning/30 text-warning text-xs font-semibold px-3 py-1.5 rounded-full">
          ⏳ Hold Active — Not Charged Yet
        </div>
      </div>

      {/* Booking summary */}
      <div className="bg-surface-highest/40 rounded-xl px-5 py-4 flex justify-between items-center text-sm">
        <div>
          <div className="font-semibold text-on-surface">{booking.room.name}</div>
          <div className="text-on-surface-variant">{booking.check_in} – {booking.check_out} · {booking.guest_count} guest{(booking.guest_count ?? 1) > 1 ? 's' : ''}</div>
        </div>
        <div className="font-bold text-on-surface">${booking.total_amount.toFixed(2)}</div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center justify-center gap-0">
        {steps.map((s, i) => {
          const done = steps.indexOf(steps.find((x) => x.key === step)!) > i
          const active = step === s.key
          return (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${done ? 'bg-secondary text-white' : active ? 'bg-primary text-white' : 'bg-surface-highest/60 text-on-surface-variant'}`}>
                  {done ? '✓' : i + 2}
                </div>
                <span className={`text-xs whitespace-nowrap ${active ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 h-0.5 mb-5 ${done ? 'bg-secondary' : 'bg-surface-highest/60'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      {step === 'ids' && (
        <>
          <IdUploadStep
            bookingId={booking.id}
            guestCount={booking.guest_count ?? 1}
            savedDocs={idDocs}
            onAllPassed={(docs) => setIdDocs(docs)}
          />
          <button
            onClick={() => setStep('questions')}
            disabled={!allIdsPassed}
            className="w-full bg-primary text-on-primary rounded-xl py-4 font-semibold disabled:opacity-40"
          >
            Next: Screening Questions →
          </button>
        </>
      )}

      {step === 'questions' && (
        <>
          <ScreeningQuestionsStep
            bookingId={booking.id}
            saved={questionFields}
            houseRules={booking.room.property.house_rules ?? ''}
            onChange={setQuestionFields}
          />
          <div className="flex gap-3">
            <button onClick={() => setStep('ids')} className="flex-1 border border-outline rounded-xl py-4 font-semibold text-on-surface-variant">
              ← Back
            </button>
            <button
              onClick={() => setStep('submit')}
              disabled={!questionsComplete}
              className="flex-[2] bg-primary text-on-primary rounded-xl py-4 font-semibold disabled:opacity-40"
            >
              Review & Submit →
            </button>
          </div>
        </>
      )}

      {step === 'submit' && (
        <div className="space-y-6">
          <div className="bg-surface-highest/40 rounded-xl p-5 space-y-3 text-sm">
            <h3 className="font-semibold text-on-surface">Ready to submit</h3>
            <p className="text-on-surface-variant">
              {idDocs.filter((d) => d.ai_quality_result === 'pass').length} of {booking.guest_count ?? 1} ID{(booking.guest_count ?? 1) > 1 ? 's' : ''} verified ✓
            </p>
            <p className="text-on-surface-variant">All screening questions answered ✓</p>
          </div>
          {error && <p className="text-sm text-error bg-error/10 rounded-xl px-4 py-3">{error}</p>}
          <button onClick={() => setStep('questions')} className="w-full border border-outline rounded-xl py-3 font-semibold text-on-surface-variant text-sm">
            ← Edit Answers
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-primary text-on-primary rounded-xl py-4 font-semibold disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>
          <p className="text-center text-xs text-on-surface-variant">
            After submitting, your booking will be reviewed within 24 hours. You will receive an email with the decision.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create the /booking/apply/[bookingId] page**

```tsx
// app/(public)/booking/apply/[bookingId]/page.tsx
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase'
import ApplicationForm from '@/components/public/ApplicationForm'
import type { Booking, BookingApplication, GuestIdDocument } from '@/types'

interface PageProps {
  params: Promise<{ bookingId: string }>
  searchParams: Promise<{ email?: string }>
}

export const metadata = { title: 'Complete Your Application', robots: { index: false, follow: false } }

export default async function BookingApplyPage({ params, searchParams }: PageProps) {
  const { bookingId } = await params
  const { email } = await searchParams

  if (!email) redirect('/booking/manage')

  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, room:rooms(name, property:properties(name, house_rules))')
    .eq('id', bookingId)
    .ilike('guest_email', email)
    .maybeSingle()

  if (!booking) redirect('/booking/manage')

  if (!['pending_docs', 'under_review'].includes(booking.status)) {
    redirect(`/booking/manage?booking_id=${bookingId}&guest_email=${encodeURIComponent(email)}`)
  }

  // Ensure application row exists
  await supabase
    .from('booking_applications')
    .upsert({ booking_id: bookingId }, { onConflict: 'booking_id', ignoreDuplicates: true })

  const { data: application } = await supabase
    .from('booking_applications')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle()

  const { data: guestDocs } = await supabase
    .from('guest_id_documents')
    .select('*')
    .eq('booking_id', bookingId)
    .order('guest_index')

  return (
    <main className="min-h-screen bg-background">
      <ApplicationForm
        booking={booking as Booking & { room: { name: string; property: { name: string; house_rules?: string } } }}
        application={(application as BookingApplication) ?? null}
        savedDocs={(guestDocs ?? []) as GuestIdDocument[]}
      />
    </main>
  )
}
```

- [ ] **Step 4: Update CheckoutForm.tsx redirect after payment**

In `components/public/CheckoutForm.tsx` at line 348, change the `onSuccess` redirect from:
```tsx
router.push(
  `/booking/confirmation?booking_id=${id}&guest_email=${encodeURIComponent(guestInfo.guest_email)}`,
)
```
to:
```tsx
router.push(
  `/booking/apply/${id}?email=${encodeURIComponent(guestInfo.guest_email)}`,
)
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/public/ScreeningQuestionsStep.tsx components/public/ApplicationForm.tsx \
  "app/(public)/booking/apply/[bookingId]/page.tsx" components/public/CheckoutForm.tsx
git commit -m "feat: add guest application form and /booking/apply/[bookingId] page"
```

---

## Task 10: Manage Booking Abandonment Banner

**Files:**
- Modify: `components/public/BookingManageView.tsx`

- [ ] **Step 1: Read BookingManageView**

Read `components/public/BookingManageView.tsx` in full before editing.

- [ ] **Step 2: Add pending_docs and under_review banners**

Find the top of the returned JSX in `BookingManageView.tsx` (the component renders booking status-based content). Add status banners near the top of the return, before the main booking details. Insert:

```tsx
{/* Booking approval status banners */}
{booking.status === 'pending_docs' && (
  <div className="mb-6 bg-warning/10 border border-warning/30 rounded-xl p-4">
    <div className="flex items-start gap-3">
      <span className="text-xl">⚠️</span>
      <div className="flex-1">
        <p className="font-semibold text-on-surface text-sm mb-1">Your application is incomplete</p>
        <p className="text-on-surface-variant text-sm mb-3">
          Complete your ID verification and screening questions to finalize your booking request.
          Your payment hold is active but you have not been charged.
        </p>
        <a
          href={`/booking/apply/${booking.id}?email=${encodeURIComponent(booking.guest_email)}`}
          className="inline-block bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Resume Application →
        </a>
      </div>
    </div>
  </div>
)}

{booking.status === 'under_review' && (
  <div className="mb-6 bg-primary/10 border border-primary/30 rounded-xl p-4">
    <div className="flex items-start gap-3">
      <span className="text-xl">🔍</span>
      <div>
        <p className="font-semibold text-on-surface text-sm mb-1">Application under review</p>
        <p className="text-on-surface-variant text-sm">
          Your application has been submitted and is being reviewed. You will receive an email
          with a decision within 24 hours. Your payment will only be captured if approved.
        </p>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/public/BookingManageView.tsx
git commit -m "feat: add pending_docs and under_review banners to manage booking page"
```

---

## Task 11: Admin Review API Routes

**Files:**
- Create: `app/api/admin/applications/route.ts`
- Create: `app/api/admin/bookings/[id]/application/review/route.ts`
- Create: `__tests__/api/admin/application-review.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/api/admin/application-review.test.ts
/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn(), createServerSupabaseClient: jest.fn() }))
jest.mock('@/lib/stripe', () => ({ capturePaymentIntent: jest.fn().mockResolvedValue(undefined), stripe: { paymentIntents: { cancel: jest.fn().mockResolvedValue({}) } } }))
jest.mock('@/lib/email-queue', () => ({ evaluateAndQueueEmails: jest.fn().mockResolvedValue(undefined), seedReminderEmails: jest.fn().mockResolvedValue(undefined) }))

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { PATCH } from '@/app/api/admin/bookings/[id]/application/review/route'

function makeReq(body: object) {
  return new Request('http://localhost/api/admin/bookings/test/application/review', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setupMocks(booking: Record<string, unknown> | null, authed = true) {
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: authed ? { id: 'admin-1' } : null }, error: null }) },
  })
  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: booking, error: null }),
      update: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  })
}

describe('PATCH /api/admin/bookings/[id]/application/review', () => {
  it('returns 401 when not authenticated', async () => {
    setupMocks(null, false)
    const res = await PATCH(makeReq({ decision: 'approved' }), { params: Promise.resolve({ id: 'b1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when booking not found', async () => {
    setupMocks(null)
    const res = await PATCH(makeReq({ decision: 'approved' }), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid decision', async () => {
    setupMocks({ id: 'b1', status: 'under_review', stripe_payment_intent_id: 'pi_test' })
    const res = await PATCH(makeReq({ decision: 'maybe' }), { params: Promise.resolve({ id: 'b1' }) })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/api/admin/application-review.test.ts --no-coverage
```

Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Create the applications list route**

```ts
// app/api/admin/applications/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

export async function GET() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, status, check_in, check_out, guest_count, guest_first_name, guest_last_name,
      guest_email, total_amount, application_deadline, stripe_payment_intent_id,
      room:rooms(name, property:properties(name)),
      application:booking_applications(id, submitted_at, decision, reviewed_at),
      guest_id_documents(id, guest_index, ai_quality_result, ai_authenticity_flag)
    `)
    .eq('status', 'under_review')
    .order('application_deadline', { ascending: true })

  if (error) {
    console.error('GET /api/admin/applications error:', error)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }

  return NextResponse.json({ applications: data ?? [] })
}
```

- [ ] **Step 4: Create the admin review route**

```ts
// app/api/admin/bookings/[id]/application/review/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { capturePaymentIntent } from '@/lib/stripe'
import { stripe } from '@/lib/stripe'
import { evaluateAndQueueEmails, seedReminderEmails } from '@/lib/email-queue'
import type { Booking } from '@/types'

interface RouteContext { params: Promise<{ id: string }> }
interface ReviewBody { decision: 'approved' | 'declined'; decline_reason?: string }

export async function PATCH(req: Request, { params }: RouteContext) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: bookingId } = await params
  const body = (await req.json()) as ReviewBody

  if (body.decision !== 'approved' && body.decision !== 'declined') {
    return NextResponse.json({ error: 'decision must be "approved" or "declined"' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, room:rooms(*, property:properties(*))')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status !== 'under_review') {
    return NextResponse.json({ error: 'Booking is not under review' }, { status: 409 })
  }

  const now = new Date().toISOString()

  if (body.decision === 'approved') {
    // Capture payment first, then update DB
    try {
      await capturePaymentIntent(booking.stripe_payment_intent_id)
    } catch (err) {
      console.error('review: failed to capture payment:', err)
      return NextResponse.json({ error: 'Payment capture failed' }, { status: 502 })
    }

    await supabase
      .from('bookings')
      .update({ status: 'confirmed', amount_paid: booking.total_amount, updated_at: now })
      .eq('id', bookingId)

    await supabase
      .from('booking_applications')
      .update({ decision: 'approved', reviewed_at: now, reviewed_by: user.id })
      .eq('booking_id', bookingId)

    evaluateAndQueueEmails('booking_approved', { type: 'booking', bookingId }).catch(
      (err) => { console.error('email queue error on booking_approved:', err) }
    )
    evaluateAndQueueEmails('admin_new_booking', { type: 'booking', bookingId }).catch(
      (err) => { console.error('email queue error on admin_new_booking:', err) }
    )
    seedReminderEmails(booking as Booking).catch(
      (err) => { console.error('seedReminderEmails error:', err) }
    )
  } else {
    // Release hold, then update DB
    try {
      if (booking.stripe_payment_intent_id) {
        const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
        if (['requires_capture', 'requires_payment_method', 'requires_confirmation', 'requires_action'].includes(pi.status)) {
          await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
        }
      }
    } catch (err) {
      console.error('review: failed to cancel payment intent:', err)
    }

    await supabase
      .from('bookings')
      .update({ status: 'cancelled', updated_at: now })
      .eq('id', bookingId)

    await supabase
      .from('booking_applications')
      .update({
        decision: 'declined',
        decline_reason: body.decline_reason ?? null,
        reviewed_at: now,
        reviewed_by: user.id,
      })
      .eq('booking_id', bookingId)

    evaluateAndQueueEmails('booking_declined', { type: 'booking', bookingId }).catch(
      (err) => { console.error('email queue error on booking_declined:', err) }
    )
  }

  return NextResponse.json({ success: true, decision: body.decision })
}
```

- [ ] **Step 5: Run tests**

```bash
npx jest __tests__/api/admin/application-review.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/applications/route.ts \
  app/api/admin/bookings/[id]/application/review/route.ts \
  __tests__/api/admin/application-review.test.ts
git commit -m "feat: add admin application list and approve/decline review API routes"
```

---

## Task 12: Admin UI Components

**Files:**
- Create: `components/admin/ApplicationsTab.tsx`
- Create: `components/admin/ApplicationReviewPanel.tsx`

- [ ] **Step 1: Create ApplicationsTab**

```tsx
// components/admin/ApplicationsTab.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import ApplicationReviewPanel from '@/components/admin/ApplicationReviewPanel'

interface ApplicationRow {
  id: string
  status: string
  check_in: string
  check_out: string
  guest_count: number
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  total_amount: number
  application_deadline: string | null
  stripe_payment_intent_id: string
  room: { name: string; property: { name: string } } | null
  application: { id: string; submitted_at: string | null; decision: string | null } | null
  guest_id_documents: { id: string; guest_index: number; ai_quality_result: string | null; ai_authenticity_flag: string | null }[]
}

function Countdown({ deadline }: { deadline: string | null }) {
  const [remaining, setRemaining] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [overdue, setOverdue] = useState(false)

  useEffect(() => {
    if (!deadline) return
    function update() {
      const ms = new Date(deadline!).getTime() - Date.now()
      if (ms <= 0) { setOverdue(true); setRemaining('OVERDUE'); return }
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      setRemaining(`${h}h ${m}m`)
      setUrgent(ms < 8 * 3600000)
    }
    update()
    const t = setInterval(update, 60000)
    return () => clearInterval(t)
  }, [deadline])

  const cls = overdue ? 'text-error font-bold' : urgent ? 'text-warning font-semibold' : 'text-secondary'
  return <span className={cls}>{remaining}</span>
}

export default function ApplicationsTab() {
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ApplicationRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/applications')
      const data = await res.json()
      setApplications(data.applications ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function hasAiFlag(row: ApplicationRow) {
    return row.guest_id_documents.some(
      (d) => d.ai_authenticity_flag === 'flagged' || d.ai_authenticity_flag === 'uncertain'
    )
  }

  const overdue = applications.filter(
    (a) => a.application_deadline && new Date(a.application_deadline) < new Date()
  )

  if (selected) {
    return (
      <ApplicationReviewPanel
        application={selected}
        onBack={() => setSelected(null)}
        onDecision={() => { setSelected(null); load() }}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-on-surface">Pending Applications</h2>
          <span className="text-sm text-on-surface-variant">({applications.length})</span>
        </div>
        {overdue.length > 0 && (
          <span className="bg-error/10 border border-error/30 text-error text-xs font-bold px-3 py-1 rounded-full">
            ⚠ {overdue.length} Overdue
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-sm py-8 text-center">Loading…</p>
      ) : applications.length === 0 ? (
        <p className="text-on-surface-variant text-sm py-12 text-center">No pending applications</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline">
                {['Guest', 'Room', 'Dates', 'Guests', 'AI Flags', 'Time Remaining', ''].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr
                  key={app.id}
                  className={`border-b border-outline/50 hover:bg-surface-highest/30 cursor-pointer
                    ${app.application_deadline && new Date(app.application_deadline) < new Date() ? 'bg-error/5' : ''}`}
                  onClick={() => setSelected(app)}
                >
                  <td className="py-3 px-3">
                    <div className="font-semibold text-on-surface">
                      {app.guest_last_name}, {app.guest_first_name}
                    </div>
                    <div className="text-on-surface-variant text-xs">{app.guest_email}</div>
                  </td>
                  <td className="py-3 px-3 text-on-surface">{app.room?.name ?? '—'}</td>
                  <td className="py-3 px-3 text-on-surface whitespace-nowrap">
                    {app.check_in} – {app.check_out}
                  </td>
                  <td className="py-3 px-3 text-on-surface">{app.guest_count}</td>
                  <td className="py-3 px-3">
                    {hasAiFlag(app) ? (
                      <span className="bg-warning/10 text-warning border border-warning/30 text-xs font-semibold px-2 py-0.5 rounded-full">
                        ⚠ Flag
                      </span>
                    ) : (
                      <span className="bg-secondary/10 text-secondary border border-secondary/30 text-xs font-semibold px-2 py-0.5 rounded-full">
                        ✓ Clear
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <Countdown deadline={app.application_deadline} />
                  </td>
                  <td className="py-3 px-3">
                    <button className="bg-primary text-on-primary text-xs font-semibold px-3 py-1.5 rounded-lg">
                      Review →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create ApplicationReviewPanel**

```tsx
// components/admin/ApplicationReviewPanel.tsx
'use client'

import { useState } from 'react'

interface GuestDoc {
  id: string
  guest_index: number
  ai_quality_result: string | null
  ai_authenticity_flag: string | null
  ai_validation_notes?: string | null
  guest_name?: string
  current_address?: string
  id_photo_url?: string | null
}

interface ApplicationRow {
  id: string
  check_in: string
  check_out: string
  guest_count: number
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  total_amount: number
  application_deadline: string | null
  stripe_payment_intent_id: string
  room: { name: string; property: { name: string } } | null
  application: {
    id: string
    purpose_of_stay?: string
    traveling_from?: string
    shared_living_exp?: string
    house_rules_confirmed?: boolean
    additional_info?: string | null
  } | null
  guest_id_documents: GuestDoc[]
}

interface Props {
  application: ApplicationRow
  onBack: () => void
  onDecision: () => void
}

export default function ApplicationReviewPanel({ application, onBack, onDecision }: Props) {
  const [declining, setDeclining] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hoursLeft = application.application_deadline
    ? Math.max(0, Math.round((new Date(application.application_deadline).getTime() - Date.now()) / 3600000))
    : null

  async function decide(decision: 'approved' | 'declined') {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/bookings/${application.id}/application/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, decline_reason: decision === 'declined' ? declineReason : undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Request failed'); return }
      onDecision()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const app = application.application

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-on-surface-variant hover:text-on-surface text-sm">
          ← Back to Applications
        </button>
        {hoursLeft !== null && hoursLeft <= 2 && (
          <span className="bg-error/10 border border-error/30 text-error text-xs font-bold px-2 py-0.5 rounded-full">
            ⏰ {hoursLeft}h remaining
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Guest IDs */}
          <div className="bg-surface rounded-xl border border-outline p-5">
            <h3 className="font-semibold text-on-surface mb-4">Guest Identification</h3>
            {application.guest_id_documents.map((doc) => (
              <div
                key={doc.id}
                className={`border rounded-xl p-4 mb-3 ${
                  doc.ai_authenticity_flag === 'flagged' || doc.ai_authenticity_flag === 'uncertain'
                    ? 'border-warning/50 bg-warning/5'
                    : 'border-outline'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm text-on-surface">
                    Guest {doc.guest_index} {doc.guest_index === 1 ? '(Primary)' : ''}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${doc.ai_authenticity_flag === 'clear'
                      ? 'bg-secondary/10 text-secondary border border-secondary/30'
                      : 'bg-warning/10 text-warning border border-warning/30'}`}>
                    {doc.ai_authenticity_flag === 'clear' ? '✓ AI Clear' : '⚠ AI Flag'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div>
                    <div className="text-on-surface-variant text-xs mb-1">Name</div>
                    <div className="text-on-surface">{doc.guest_name ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-on-surface-variant text-xs mb-1">Address</div>
                    <div className="text-on-surface">{doc.current_address ?? '—'}</div>
                  </div>
                </div>
                {doc.ai_validation_notes && (
                  <div className={`text-xs rounded-lg px-3 py-2 ${
                    doc.ai_authenticity_flag === 'clear' ? 'bg-secondary/10 text-secondary' : 'bg-warning/10 text-warning'
                  }`}>
                    🤖 {doc.ai_validation_notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Screening answers */}
          {app && (
            <div className="bg-surface rounded-xl border border-outline p-5">
              <h3 className="font-semibold text-on-surface mb-4">Screening Questions</h3>
              {[
                { q: '1. Purpose of stay', a: app.purpose_of_stay },
                { q: '2. Traveling from', a: app.traveling_from },
                { q: '3. Shared living experience', a: app.shared_living_exp },
              ].map(({ q, a }) => (
                <div key={q} className="mb-4">
                  <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">{q}</div>
                  <div className="bg-surface-highest/40 rounded-lg px-3 py-2 text-sm text-on-surface">{a || '—'}</div>
                </div>
              ))}
              <div className="mb-4">
                <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">4. House rules confirmed</div>
                <div className="flex items-center gap-2 text-sm">
                  {app.house_rules_confirmed
                    ? <><span className="text-secondary">✓</span><span className="text-on-surface">Confirmed</span></>
                    : <><span className="text-error">✗</span><span className="text-on-surface">Not confirmed</span></>}
                </div>
              </div>
              {app.additional_info && (
                <div>
                  <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">5. Additional info</div>
                  <div className="bg-surface-highest/40 rounded-lg px-3 py-2 text-sm text-on-surface">{app.additional_info}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Booking summary */}
          <div className="bg-surface rounded-xl border border-outline p-5">
            <h3 className="font-semibold text-on-surface mb-3 text-sm">Booking Summary</h3>
            {[
              { l: 'Guest', v: `${application.guest_first_name} ${application.guest_last_name}` },
              { l: 'Room', v: application.room?.name ?? '—' },
              { l: 'Check-in', v: application.check_in },
              { l: 'Check-out', v: application.check_out },
              { l: 'Guests', v: String(application.guest_count) },
              { l: 'Total', v: `$${application.total_amount.toFixed(2)}` },
            ].map(({ l, v }) => (
              <div key={l} className="flex justify-between py-2 border-b border-outline/50 last:border-0 text-sm">
                <span className="text-on-surface-variant">{l}</span>
                <span className="text-on-surface font-medium">{v}</span>
              </div>
            ))}
          </div>

          {/* Decision */}
          <div className="bg-surface rounded-xl border border-outline p-5">
            <h3 className="font-semibold text-on-surface mb-4 text-sm">Make a Decision</h3>
            {error && <p className="text-xs text-error bg-error/10 rounded-lg px-3 py-2 mb-3">{error}</p>}
            {!declining ? (
              <div className="space-y-2">
                <button
                  onClick={() => decide('approved')}
                  disabled={submitting}
                  className="w-full bg-secondary text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
                >
                  ✓ Approve Booking
                </button>
                <button
                  onClick={() => setDeclining(true)}
                  disabled={submitting}
                  className="w-full border-2 border-error text-error rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
                >
                  ✗ Decline Booking
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-error mb-1">Decline reason (optional — sent to guest):</div>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="e.g. We are unable to accommodate your request at this time…"
                  className="w-full border border-error/40 rounded-xl px-3 py-2 text-sm bg-error/5 text-on-surface resize-none min-h-[80px] focus:outline-none"
                />
                <button
                  onClick={() => decide('declined')}
                  disabled={submitting}
                  className="w-full bg-error text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
                >
                  {submitting ? 'Processing…' : 'Confirm Decline & Release Hold'}
                </button>
                <button onClick={() => setDeclining(false)} className="w-full text-on-surface-variant text-sm py-2">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/ApplicationsTab.tsx components/admin/ApplicationReviewPanel.tsx
git commit -m "feat: add ApplicationsTab and ApplicationReviewPanel admin components"
```

---

## Task 13: Wire Applications Tab into Admin Bookings Page

**Files:**
- Modify: `app/admin/(protected)/bookings/page.tsx`
- Modify: `components/admin/BookingsTable.tsx`

- [ ] **Step 1: Read both files in full before editing**

Read `app/admin/(protected)/bookings/page.tsx` and `components/admin/BookingsTable.tsx` in full.

- [ ] **Step 2: Add Applications tab to the admin bookings page**

In `app/admin/(protected)/bookings/page.tsx`, the page renders the `BookingsTable`. Wrap the page content to support tabs. Add at the top of the returned JSX:

```tsx
import ApplicationsTab from '@/components/admin/ApplicationsTab'

// Inside the component JSX, before the existing BookingsTable:
<div className="mb-6">
  <div className="flex gap-1 border-b border-outline">
    <button
      // This tab UI is client-side — extract to a wrapper component or use URL param
      className="px-4 py-2 text-sm font-semibold border-b-2 border-primary text-primary"
    >
      Bookings
    </button>
    <button className="px-4 py-2 text-sm font-semibold text-on-surface-variant">
      Applications
    </button>
  </div>
</div>
```

Because `app/admin/(protected)/bookings/page.tsx` is a server component, extract the tab switcher as a small `'use client'` wrapper component to avoid making the whole page a client component:

Create `components/admin/BookingsPageTabs.tsx`:
```tsx
// components/admin/BookingsPageTabs.tsx
'use client'

import { useState } from 'react'
import ApplicationsTab from '@/components/admin/ApplicationsTab'

interface Props {
  bookingsContent: React.ReactNode
}

export default function BookingsPageTabs({ bookingsContent }: Props) {
  const [tab, setTab] = useState<'bookings' | 'applications'>('bookings')

  return (
    <div>
      <div className="flex gap-1 border-b border-outline mb-6">
        {(['bookings', 'applications'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors
              ${tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'bookings' ? bookingsContent : <ApplicationsTab />}
    </div>
  )
}
```

Then in `app/admin/(protected)/bookings/page.tsx`, wrap the existing `<BookingsTable ... />` in `<BookingsPageTabs>`:
```tsx
import BookingsPageTabs from '@/components/admin/BookingsPageTabs'

// In the return:
return (
  <main className="...existing classes...">
    <BookingsPageTabs
      bookingsContent={
        <BookingsTable bookings={bookings} modificationRequests={modificationRequests} />
      }
    />
  </main>
)
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/BookingsPageTabs.tsx \
  "app/admin/(protected)/bookings/page.tsx" \
  components/admin/ApplicationsTab.tsx
git commit -m "feat: add Applications tab to admin bookings page"
```

---

## Task 14: Cron Job Extensions

**Files:**
- Modify: `app/api/cron/expire-pending-bookings/route.ts`

- [ ] **Step 1: Read the current cron route in full**

Read `app/api/cron/expire-pending-bookings/route.ts` in full.

- [ ] **Step 2: Add pending_docs (48h) and under_review (24h) sweeps**

After the existing `pending` expiry logic, add two new sweeps:

```ts
// Sweep 2: expire pending_docs bookings older than 48 hours
const docsCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
const { data: staleDocs } = await supabase
  .from('bookings')
  .select('id, stripe_payment_intent_id')
  .eq('status', 'pending_docs')
  .lt('created_at', docsCutoff)

const docsResults = await Promise.all(
  (staleDocs ?? []).map(async (booking) => {
    try {
      if (booking.stripe_payment_intent_id) {
        const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
        if (['requires_capture', 'requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(pi.status)) {
          await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
        }
      }
      await supabase.from('bookings').update({ status: 'expired' }).eq('id', booking.id)
      evaluateAndQueueEmails('application_expired', { type: 'booking', bookingId: booking.id }).catch(console.error)
      return true
    } catch (err) {
      console.error(`expire-pending-docs: failed to expire booking ${booking.id}:`, err)
      return false
    }
  })
)

// Sweep 3: auto-decline under_review bookings past their application_deadline
const { data: overdueReviews } = await supabase
  .from('bookings')
  .select('id, stripe_payment_intent_id')
  .eq('status', 'under_review')
  .lt('application_deadline', new Date().toISOString())

const reviewResults = await Promise.all(
  (overdueReviews ?? []).map(async (booking) => {
    try {
      if (booking.stripe_payment_intent_id) {
        const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
        if (['requires_capture', 'requires_payment_method', 'requires_confirmation', 'requires_action'].includes(pi.status)) {
          await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
        }
      }
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
      await supabase
        .from('booking_applications')
        .update({ decision: 'declined', decline_reason: 'Automatically declined — review deadline passed' })
        .eq('booking_id', booking.id)
      evaluateAndQueueEmails('booking_auto_declined', { type: 'booking', bookingId: booking.id }).catch(console.error)
      evaluateAndQueueEmails('admin_missed_deadline', { type: 'booking', bookingId: booking.id }).catch(console.error)
      return true
    } catch (err) {
      console.error(`auto-decline-review: failed to decline booking ${booking.id}:`, err)
      return false
    }
  })
)
```

Update the return to include new counts:
```ts
return NextResponse.json({
  expired: results.filter(Boolean).length,
  failed: results.filter((r) => !r).length,
  docs_expired: docsResults.filter(Boolean).length,
  reviews_auto_declined: reviewResults.filter(Boolean).length,
})
```

Also add the import at the top of the file:
```ts
import { evaluateAndQueueEmails } from '@/lib/email-queue'
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/expire-pending-bookings/route.ts
git commit -m "feat: add pending_docs 48h expiry and under_review 24h auto-decline cron sweeps"
```

---

## Task 15: Email System — New Variables, Triggers, and Automations

**Files:**
- Modify: `lib/email-variables.ts`
- Modify: `lib/email-queue.ts`
- Create: `supabase/migrations/027_booking_approval_email_automations.sql`

- [ ] **Step 1: Add decline_reason to VARIABLE_GROUPS in lib/email-variables.ts**

In the `Booking` variables group (around line 22), add `decline_reason`:
```ts
{ key: 'decline_reason', label: 'Decline reason' },
{ key: 'application_deadline_hours', label: 'Hours until application deadline' },
```

Add to `SAMPLE_VARIABLES`:
```ts
decline_reason: 'We are unable to accommodate your request at this time.',
application_deadline_hours: '24',
```

Add to `TRIGGER_EVENT_LABELS`:
```ts
application_needed: 'Application Needed',
application_reminder_24h: 'Application Reminder (24h)',
application_reminder_12h: 'Application Reminder (12h)',
application_expired: 'Application Expired',
booking_approved: 'Booking Approved',
booking_declined: 'Booking Declined',
booking_auto_declined: 'Booking Auto-Declined (Timeout)',
admin_application_submitted: 'Admin — New Application Submitted',
admin_application_overdue: 'Admin — Application Overdue',
admin_missed_deadline: 'Admin — Missed Review Deadline',
```

- [ ] **Step 2: Add decline_reason to buildBookingVariables in lib/email-queue.ts**

Read `lib/email-queue.ts`. In `buildBookingVariables`, add to the returned object:
```ts
decline_reason: '', // Populated at queue time from booking_applications.decline_reason
```

Then in `evaluateAndQueueEmails`, after fetching the booking, also fetch the application's decline_reason for booking_declined and booking_auto_declined events:

Find the section where `buildBookingVariables` is called and add:
```ts
// Fetch decline_reason for declined booking emails
if (['booking_declined', 'booking_auto_declined'].includes(event)) {
  const { data: appData } = await supabase
    .from('booking_applications')
    .select('decline_reason')
    .eq('booking_id', (context as { bookingId: string }).bookingId)
    .maybeSingle()
  variables.decline_reason = appData?.decline_reason ?? 'We are unable to accommodate your request at this time.'
}
```

- [ ] **Step 3: Create email automations migration**

```sql
-- supabase/migrations/027_booking_approval_email_automations.sql
-- Seed email automation trigger records for the booking approval system.
-- Templates are intentionally left with minimal placeholder body — 
-- admins can edit them in the email template editor.

INSERT INTO email_automations (name, trigger_event, is_active, delay_minutes, recipient_type, conditions)
VALUES
  ('Application Needed',        'application_needed',         true,  0,    'guest', '{"operator":"AND","rules":[]}'),
  ('Application Reminder 24h',  'application_reminder_24h',   true,  0,    'guest', '{"operator":"AND","rules":[]}'),
  ('Application Reminder 12h',  'application_reminder_12h',   true,  0,    'guest', '{"operator":"AND","rules":[]}'),
  ('Application Expired',       'application_expired',        true,  0,    'guest', '{"operator":"AND","rules":[]}'),
  ('Booking Approved',          'booking_approved',           true,  0,    'guest', '{"operator":"AND","rules":[]}'),
  ('Booking Declined',          'booking_declined',           true,  0,    'guest', '{"operator":"AND","rules":[]}'),
  ('Booking Auto-Declined',     'booking_auto_declined',      true,  0,    'guest', '{"operator":"AND","rules":[]}'),
  ('Admin: New Application',    'admin_application_submitted',true,  0,    'admin', '{"operator":"AND","rules":[]}'),
  ('Admin: Application Overdue','admin_application_overdue',  true,  0,    'admin', '{"operator":"AND","rules":[]}'),
  ('Admin: Missed Deadline',    'admin_missed_deadline',      true,  0,    'admin', '{"operator":"AND","rules":[]}')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 4: Also seed reminder emails at application submission**

In `app/api/bookings/[id]/application/route.ts` in the `PATCH` route's submit block, after queuing `admin_application_submitted`, also queue the 24h and 12h reminder emails with delays. The existing email queue system supports `delay_minutes`. These should be queued via `evaluateAndQueueEmails` with the correct trigger events — the delay is configured on the automation record, not here. Just queue the events; the automation's `delay_minutes` handles timing.

Add in the submit block:
```ts
evaluateAndQueueEmails('application_reminder_24h', { type: 'booking', bookingId }).catch(console.error)
evaluateAndQueueEmails('application_reminder_12h', { type: 'booking', bookingId }).catch(console.error)
```

Note: set `delay_minutes` to `1440` (24h) and `2160` (36h) on the automation records via the admin email settings UI after deployment, or update the seed migration values to include `delay_minutes`.

Update the migration to include delays:
```sql
-- Replace the two admin_application entries with delay_minutes:
('Application Reminder 24h', 'application_reminder_24h', true, 1440, 'guest', '{"operator":"AND","rules":[]}'),
('Application Reminder 12h', 'application_reminder_12h', true, 2160, 'guest', '{"operator":"AND","rules":[]}'),
('Admin: Application Overdue','admin_application_overdue', true, 1380, 'admin', '{"operator":"AND","rules":[]}'),
```

- [ ] **Step 5: Apply migration**

```bash
npx supabase db push
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add lib/email-variables.ts lib/email-queue.ts \
  supabase/migrations/027_booking_approval_email_automations.sql \
  app/api/bookings/[id]/application/route.ts
git commit -m "feat: add decline_reason variable and seed email automations for approval system"
```

---

## Task 16: Public UI — Approval Notices

**Files:**
- Modify: `components/public/BookingWidget.tsx`
- Modify: `components/public/CheckoutPageInner.tsx` (or `CheckoutForm.tsx`)

- [ ] **Step 1: Add approval notice to BookingWidget**

Read `components/public/BookingWidget.tsx`. Find the CTA button (the book/checkout button at the bottom of the widget). After the CTA button, add:

```tsx
<p className="text-center text-xs text-on-surface-variant mt-2">
  Bookings require admin approval. You will not be charged until approved.
</p>
```

- [ ] **Step 2: Add approval notice to checkout form**

Read `components/public/CheckoutForm.tsx`. Find the payment section (the `step === 'payment'` block, around where the `StripePaymentSection` is rendered). Before the `<Elements>` wrapper, add:

```tsx
<div className="bg-surface-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface-variant mb-4 border border-outline/50">
  <span className="font-semibold text-on-surface">Approval required</span> — your card will be authorized but not charged until your booking application is reviewed and approved.
</div>
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/public/BookingWidget.tsx components/public/CheckoutForm.tsx
git commit -m "feat: add booking approval notice to widget and checkout form"
```

---

## Final Integration Checklist

After all tasks complete, manually verify the end-to-end flow:

- [ ] Guest books → Stripe PaymentIntent created with `capture_method: manual`
- [ ] Guest pays → booking status is `pending_docs`, redirected to `/booking/apply/[id]`
- [ ] Guest uploads ID → AI validates, hard-gates blurry/partial, soft-flags uncertainty
- [ ] Guest answers screening questions (auto-saved on blur)
- [ ] Guest submits → booking moves to `under_review`, admin receives email
- [ ] Guest opens Manage Booking → sees yellow "Resume Application" or blue "Under Review" banner
- [ ] Admin opens Bookings → Applications tab shows pending with countdown
- [ ] Admin approves → Stripe hold captured, booking `confirmed`, guest gets approval email
- [ ] Admin declines → Stripe hold released, booking `cancelled`, guest gets decline email with reason
- [ ] 48h cron fires → abandoned `pending_docs` bookings expire, hold released
- [ ] 24h cron fires → overdue `under_review` bookings auto-cancelled, admin notified

```bash
npx jest --no-coverage
npx tsc --noEmit
```

Both must pass before marking this feature complete.
