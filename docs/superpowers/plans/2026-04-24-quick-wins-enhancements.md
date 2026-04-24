# Quick Wins Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three independent improvements: CSV booking export for admins, abandoned booking recovery emails, and native guest review collection with an admin approval queue.

**Architecture:** Feature A (CSV export) adds a server route + UI button with no schema changes. Feature B (abandoned recovery) adds a migration + ENUM value, then hooks `evaluateAndQueueEmails` into the existing expiry cron. Feature C (reviews) adds a `reviews` table, a public review page, an admin approval UI, and wires the pre-existing `review_request` automation to a new email template.

**Tech Stack:** Next.js App Router, Supabase (Postgres + service role client), Resend (via existing email queue), Heroicons, TailwindCSS utility classes matching existing admin style.

---

## Feature A — CSV Booking Export

### Task 1: Add `room_url` and `review_page_url` email template variables

**Files:**
- Modify: `lib/email-queue.ts` (inside `buildBookingVariables`)
- Modify: `lib/email-variables.ts` (VARIABLE_GROUPS + SAMPLE_VARIABLES)

- [ ] **Step 1: Add variables to `buildBookingVariables`**

In `lib/email-queue.ts`, inside `buildBookingVariables`, add two new entries to the returned object after `review_url`:

```typescript
    review_url: emailSettings?.review_url ?? '',
    room_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/rooms/${room.slug}`,
    review_page_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/review/${booking.id}`,
```

- [ ] **Step 2: Expose in admin template editor**

In `lib/email-variables.ts`, add to the `'Booking'` group variables array:

```typescript
      { key: 'room_url', label: 'Room page URL' },
      { key: 'review_page_url', label: 'Review page URL' },
```

And add to `SAMPLE_VARIABLES`:

```typescript
  room_url: 'https://topofthehillrooms.com/rooms/garden-suite',
  review_page_url: 'https://topofthehillrooms.com/review/booking-id-here',
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/email-queue.ts lib/email-variables.ts
git commit -m "feat: add room_url and review_page_url email template variables"
```

---

### Task 2: CSV export API route + test

**Files:**
- Create: `app/api/admin/bookings/export/route.ts`
- Create: `__tests__/api/admin/bookings-export.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/admin/bookings-export.test.ts`:

```typescript
/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockGetUser = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: mockGetUser },
  })
})

function makeRequest(qs = '') {
  return new Request(`http://localhost/api/admin/bookings/export${qs}`)
}

const sampleBookings = [
  {
    id: 'b-1',
    guest_first_name: 'Jane',
    guest_last_name: 'Doe',
    guest_email: 'jane@example.com',
    room: { name: 'Room A', property: { name: 'Hill House' } },
    check_in: '2026-05-01',
    check_out: '2026-05-07',
    total_nights: 6,
    total_amount: 600,
    status: 'confirmed',
    source: 'direct',
    notes: null,
    created_at: '2026-04-01T12:00:00Z',
  },
]

function buildQueryChain(rows: unknown[]) {
  const result = { data: rows, error: null }
  const chain: Record<string, unknown> = {
    then: (resolve: (v: typeof result) => void) => resolve(result),
  }
  for (const m of ['select', 'order', 'eq', 'gte', 'lte']) {
    chain[m] = jest.fn().mockReturnValue(chain)
  }
  return jest.fn().mockReturnValue(chain)
}

// Lazy import so mocks are set up first
let GET: (req: Request) => Promise<Response>
beforeAll(async () => {
  ;({ GET } = await import('@/app/api/admin/bookings/export/route'))
})

describe('GET /api/admin/bookings/export', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns CSV with correct column headers', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: buildQueryChain(sampleBookings) })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')
    const text = await res.text()
    expect(text).toContain('Booking ID,Guest Name,Guest Email,Room')
    expect(text).toContain('b-1')
    expect(text).toContain('Jane Doe')
    expect(text).toContain('jane@example.com')
  })

  it('wraps fields containing commas in quotes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    const booking = { ...sampleBookings[0], notes: 'Late check-in, please call' }
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: buildQueryChain([booking]) })
    const res = await GET(makeRequest())
    const text = await res.text()
    expect(text).toContain('"Late check-in, please call"')
  })

  it('sets Content-Disposition attachment header', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: buildQueryChain([]) })
    const res = await GET(makeRequest())
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="bookings-/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/admin/bookings-export.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/admin/bookings/export/route'`

- [ ] **Step 3: Create the route**

Create `app/api/admin/bookings/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

function escapeCSV(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: NextRequest) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('bookings')
    .select('*, room:rooms(name, property:properties(name))')
    .order('created_at', { ascending: false })

  if (status && status !== 'all') query = query.eq('status', status)
  if (type && type !== 'all') query = query.eq('booking_type', type)
  if (from) query = query.gte('check_in', from)
  if (to) query = query.lte('check_in', to)

  const { data: bookings, error } = await query
  if (error) return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })

  const HEADERS = [
    'Booking ID', 'Guest Name', 'Guest Email', 'Room',
    'Check-in', 'Check-out', 'Nights', 'Total Price',
    'Status', 'Source', 'Notes', 'Created At',
  ]

  type BookingRow = {
    id: string
    guest_first_name: string
    guest_last_name: string
    guest_email: string
    room: { name: string } | null
    check_in: string
    check_out: string
    total_nights: number
    total_amount: number
    status: string
    source: string | null
    notes: string | null
    created_at: string
  }

  const rows = (bookings as BookingRow[]).map(b => [
    b.id,
    `${b.guest_first_name} ${b.guest_last_name}`,
    b.guest_email,
    b.room?.name ?? '',
    b.check_in,
    b.check_out,
    b.total_nights,
    b.total_amount,
    b.status,
    b.source ?? '',
    b.notes ?? '',
    b.created_at,
  ])

  const csv = [HEADERS, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n')
  const filename = `bookings-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/admin/bookings-export.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/bookings/export/route.ts __tests__/api/admin/bookings-export.test.ts
git commit -m "feat: add CSV booking export API route"
```

---

### Task 3: Export CSV button in BookingsClient

**Files:**
- Modify: `components/admin/BookingsClient.tsx`

- [ ] **Step 1: Add `handleExport` function**

In `components/admin/BookingsClient.tsx`, after the `quickConfirm` function (around line 324), add:

```typescript
  function handleExport() {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    window.location.href = `/api/admin/bookings/export?${params.toString()}`
  }
```

- [ ] **Step 2: Replace the page header right-side with a button group**

Find this JSX in the return block (around line 360):

```tsx
        <NewManualBookingButton />
```

Replace with:

```tsx
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '13px',
              color: '#475569',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Export CSV
          </button>
          <NewManualBookingButton />
        </div>
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/BookingsClient.tsx
git commit -m "feat: add Export CSV button to admin bookings table"
```

---

## Feature B — Abandoned Booking Recovery Email

### Task 4: Migration + TypeScript type for `booking_abandoned` event

**Files:**
- Create: `supabase/migrations/025_abandoned_booking_recovery.sql`
- Modify: `types/index.ts`

- [ ] **Step 1: Add `booking_abandoned` to the TypeScript union type**

In `types/index.ts`, find `TriggerEvent` (line 274). Add `'booking_abandoned'` to the union:

```typescript
export type TriggerEvent =
  | 'booking_confirmed'
  | 'booking_pending'
  | 'booking_cancelled'
  | 'booking_abandoned'
  | 'contact_submitted'
  | 'checkin_reminder'
  | 'checkout_reminder'
  | 'post_checkout'
  | 'review_request'
  | 'modification_requested'
  | 'admin_new_booking'
  | 'admin_cancelled'
  | 'booking_payment_request'
```

- [ ] **Step 2: Create the migration**

Create `supabase/migrations/025_abandoned_booking_recovery.sql`:

```sql
-- Extend trigger event ENUM with the new abandoned booking event
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'booking_abandoned';

-- Seed the email template
INSERT INTO email_templates (id, name, subject, body, design, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Abandoned Booking Recovery',
  'You left something behind at {{business_name}}',
  '<p>Hi {{guest_first_name}},</p>
<p>Looks like you didn''t complete your booking for <strong>{{room_name}}</strong> on {{check_in_date}}. The room may still be available — come back and finish when you''re ready.</p>
<p><a href="{{room_url}}" style="background:#2DD4BF;color:#0F172A;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin:16px 0">Book Now →</a></p>
<p>— {{business_name}}</p>',
  NULL,
  true,
  now(),
  now()
) ON CONFLICT DO NOTHING;

-- Seed the automation that fires on booking_abandoned
INSERT INTO email_automations (
  id, name, trigger_event, is_active, delay_minutes,
  conditions, template_id, recipient_type, is_pre_planned,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'Abandoned Booking Recovery',
  'booking_abandoned',
  true,
  0,
  '{"operator":"AND","rules":[]}'::jsonb,
  id,
  'guest',
  true,
  now(),
  now()
FROM email_templates
WHERE name = 'Abandoned Booking Recovery'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies without error.

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/025_abandoned_booking_recovery.sql types/index.ts
git commit -m "feat: add booking_abandoned trigger event with email template and automation"
```

---

### Task 5: Wire recovery into expiry cron + test

**Files:**
- Modify: `app/api/cron/expire-pending-bookings/route.ts`
- Create: `__tests__/api/cron/expire-pending-bookings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/cron/expire-pending-bookings.test.ts`:

```typescript
/** @jest-environment node */

process.env.CRON_SECRET = 'test-cron-secret'

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))
jest.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      retrieve: jest.fn(),
      cancel: jest.fn().mockResolvedValue({}),
    },
  },
}))
jest.mock('@/lib/email-queue', () => ({
  evaluateAndQueueEmails: jest.fn().mockResolvedValue(undefined),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { evaluateAndQueueEmails } from '@/lib/email-queue'
import { GET } from '@/app/api/cron/expire-pending-bookings/route'

function makeRequest(secret = 'test-cron-secret') {
  return new Request('http://localhost/api/cron/expire-pending-bookings', {
    headers: { Authorization: `Bearer ${secret}` },
  })
}

const staleBooking = { id: 'booking-1', stripe_payment_intent_id: 'pi_test' }
const staleBookingNoPI = { id: 'booking-2', stripe_payment_intent_id: null }

function buildDbMock(rows: unknown[]) {
  const updateChain = { eq: jest.fn().mockResolvedValue({ error: null }) }
  const selectChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lt: jest.fn().mockResolvedValue({ data: rows, error: null }),
  }
  const from = jest.fn()
    .mockReturnValueOnce(selectChain)
    .mockReturnValue({ update: jest.fn().mockReturnValue(updateChain) })
  return from
}

describe('expire-pending-bookings cron', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 with wrong secret', async () => {
    const res = await GET(makeRequest('wrong') as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(401)
  })

  it('expires bookings and queues a recovery email for each', async () => {
    ;(stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValue({ status: 'requires_payment_method' })
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: buildDbMock([staleBooking]) })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.expired).toBe(1)
    expect(data.failed).toBe(0)
    expect(evaluateAndQueueEmails).toHaveBeenCalledWith('booking_abandoned', {
      type: 'booking',
      bookingId: 'booking-1',
    })
  })

  it('skips Stripe cancel when payment intent is absent', async () => {
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: buildDbMock([staleBookingNoPI]) })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled()
    expect(evaluateAndQueueEmails).toHaveBeenCalledWith('booking_abandoned', {
      type: 'booking',
      bookingId: 'booking-2',
    })
  })

  it('counts failed bookings but still processes others', async () => {
    ;(stripe.paymentIntents.retrieve as jest.Mock).mockRejectedValue(new Error('Stripe down'))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: buildDbMock([staleBooking]) })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    const data = await res.json()
    expect(data.failed).toBe(1)
    expect(evaluateAndQueueEmails).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/cron/expire-pending-bookings.test.ts --no-coverage
```

Expected: FAIL — `evaluateAndQueueEmails` was not called.

- [ ] **Step 3: Update the expiry cron route**

In `app/api/cron/expire-pending-bookings/route.ts`, add the import at the top:

```typescript
import { evaluateAndQueueEmails } from '@/lib/email-queue'
```

Inside the `map` callback, after the `update` call succeeds, add the email queue call:

```typescript
        await supabase.from('bookings').update({ status: 'expired' }).eq('id', booking.id)
        await evaluateAndQueueEmails('booking_abandoned', { type: 'booking', bookingId: booking.id })
        return true
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/api/cron/expire-pending-bookings.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/expire-pending-bookings/route.ts __tests__/api/cron/expire-pending-bookings.test.ts
git commit -m "feat: queue abandoned booking recovery email when pending booking expires"
```

---

## Feature C — Native Review Collection

### Task 6: Reviews DB migration + review_request email template

**Files:**
- Create: `supabase/migrations/026_reviews.sql`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/026_reviews.sql`:

```sql
-- Reviews table (one review per booking, admin-approved before public display)
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the Review Request email template
-- The 'review_request' automation was created in migration 010 but has no template.
-- This seeds the template and wires it to the automation.
INSERT INTO email_templates (id, name, subject, body, design, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Review Request',
  'How was your stay at {{room_name}}?',
  '<p>Hi {{guest_first_name}},</p>
<p>We hope you enjoyed your recent stay at <strong>{{room_name}}</strong>. Your feedback means the world to us!</p>
<p><a href="{{review_page_url}}" style="background:#2DD4BF;color:#0F172A;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin:16px 0">Leave a Review →</a></p>
<p>Thank you for staying with us.</p>
<p>— {{business_name}}</p>',
  NULL,
  true,
  now(),
  now()
) ON CONFLICT DO NOTHING;

-- Wire the pre-planned Review Request automation to this template and activate it
UPDATE email_automations
SET
  template_id = (SELECT id FROM email_templates WHERE name = 'Review Request' LIMIT 1),
  is_active = true,
  updated_at = now()
WHERE trigger_event = 'review_request'
  AND template_id IS NULL;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/026_reviews.sql
git commit -m "feat: add reviews table and seed review_request email template"
```

---

### Task 7: Public review page + submission API

**Files:**
- Create: `app/(public)/review/[bookingId]/page.tsx`
- Create: `app/(public)/review/[bookingId]/ReviewForm.tsx`
- Create: `app/api/reviews/[bookingId]/route.ts`

- [ ] **Step 1: Create the review submission API**

Create `app/api/reviews/[bookingId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { bookingId: string } },
) {
  const { bookingId } = params
  const body = await request.json()
  const { rating, comment } = body

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, check_out')
    .eq('id', bookingId)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const today = new Date().toISOString().split('T')[0]
  if (booking.check_out > today) {
    return NextResponse.json({ error: 'Review not available yet' }, { status: 403 })
  }

  const { error } = await supabase.from('reviews').insert({
    booking_id: bookingId,
    rating,
    comment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
  })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Review already submitted' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Create the interactive review form client component**

Create `app/(public)/review/[bookingId]/ReviewForm.tsx`:

```typescript
'use client'

import { useState } from 'react'

export default function ReviewForm({ bookingId }: { bookingId: string }) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) { setError('Please select a star rating.'); return }
    setLoading(true)
    setError('')
    const res = await fetch(`/api/reviews/${bookingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment }),
    })
    if (res.ok) {
      setSubmitted(true)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <p className="font-display font-bold text-2xl text-on-surface mb-2">
          Thanks for your review!
        </p>
        <p className="text-on-surface-variant">
          Your feedback has been submitted and is pending approval.
        </p>
      </div>
    )
  }

  const activeStar = hovered || rating

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-on-surface mb-3">Your rating</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
            >
              <svg
                className="h-9 w-9 transition-colors"
                fill={activeStar >= star ? '#2DD4BF' : 'none'}
                stroke={activeStar >= star ? '#2DD4BF' : '#CBD5E1'}
                viewBox="0 0 20 20"
                aria-hidden
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.958z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="comment" className="block text-sm font-semibold text-on-surface mb-2">
          Comments{' '}
          <span className="font-normal text-on-surface-variant">(optional)</span>
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Tell us about your stay…"
          className="w-full rounded-lg border border-surface bg-surface-lowest px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary text-sm disabled:opacity-60"
      >
        {loading ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Create the review page (server component wrapper)**

Create `app/(public)/review/[bookingId]/page.tsx`:

```typescript
import { createServiceRoleClient } from '@/lib/supabase'
import ReviewForm from './ReviewForm'

export const dynamic = 'force-dynamic'

export default async function ReviewPage({
  params,
}: {
  params: { bookingId: string }
}) {
  const { bookingId } = params
  const supabase = createServiceRoleClient()

  const [{ data: booking }, { data: existingReview }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, guest_first_name, check_out, room:rooms(name)')
      .eq('id', bookingId)
      .single(),
    supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle(),
  ])

  const today = new Date().toISOString().split('T')[0]
  const isInvalid = !booking || booking.check_out > today

  if (isInvalid) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-background">
        <p className="text-on-surface-variant text-sm">
          This review link is invalid or not yet available.
        </p>
      </main>
    )
  }

  if (existingReview) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="text-center">
          <p className="font-display font-bold text-2xl text-on-surface mb-2">
            Already submitted!
          </p>
          <p className="text-on-surface-variant">Thank you for leaving a review.</p>
        </div>
      </main>
    )
  }

  const roomName = (booking.room as { name: string } | null)?.name ?? 'your room'

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-lg">
        <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">
          Your Stay
        </p>
        <h1 className="font-display font-extrabold text-2xl text-on-surface mb-1">
          How was {roomName}?
        </h1>
        <p className="text-on-surface-variant mb-8">
          Hi {booking.guest_first_name}, we&apos;d love to hear about your experience.
        </p>
        <ReviewForm bookingId={bookingId} />
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/(public)/review app/api/reviews
git commit -m "feat: add public review submission page and API route"
```

---

### Task 8: Admin reviews page + approve/delete API + sidebar nav item

**Files:**
- Create: `app/admin/(protected)/reviews/page.tsx`
- Create: `components/admin/ReviewsClient.tsx`
- Create: `app/api/admin/reviews/[id]/route.ts`
- Modify: `components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Create the approve/delete API route**

Create `app/api/admin/reviews/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!await requireAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { approved } = await request.json()
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('reviews')
    .update({ approved })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!await requireAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('reviews').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Create the ReviewsClient component**

Create `components/admin/ReviewsClient.tsx`:

```typescript
'use client'

import { useState } from 'react'

interface ReviewRow {
  id: string
  rating: number
  comment: string | null
  approved: boolean
  created_at: string
  booking: {
    guest_first_name: string
    guest_last_name: string
    room: { name: string } | null
  } | null
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`h-4 w-4 ${s <= count ? 'text-primary' : 'text-surface-high'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.958z" />
        </svg>
      ))}
    </div>
  )
}

export default function ReviewsClient({ reviews: initial }: { reviews: ReviewRow[] }) {
  const [reviews, setReviews] = useState(initial)

  async function toggleApprove(id: string, current: boolean) {
    await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: !current }),
    })
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, approved: !r.approved } : r)),
    )
  }

  async function deleteReview(id: string) {
    await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' })
    setReviews((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1
          className="font-display font-extrabold text-[22px]"
          style={{ color: '#0F172A' }}
        >
          Reviews
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: '#64748B' }}>
          Approve guest reviews before they appear on your homepage
        </p>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              style={{
                background: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '16px',
              }}
              className="flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Stars count={review.rating} />
                  <span className="text-xs text-on-surface-variant">
                    {review.booking?.guest_first_name} {review.booking?.guest_last_name}
                    {review.booking?.room ? ` · ${review.booking.room.name}` : ''}
                  </span>
                  <span
                    style={{
                      background: review.approved
                        ? 'rgba(5,150,105,0.08)'
                        : 'rgba(217,119,6,0.08)',
                      color: review.approved ? '#059669' : '#D97706',
                      border: `1px solid ${
                        review.approved
                          ? 'rgba(5,150,105,0.2)'
                          : 'rgba(217,119,6,0.2)'
                      }`,
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {review.approved ? 'Approved' : 'Pending'}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-on-surface-variant mt-1">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleApprove(review.id, review.approved)}
                  style={{
                    background: review.approved ? '#FEF2F2' : 'rgba(5,150,105,0.08)',
                    color: review.approved ? '#DC2626' : '#059669',
                    border: `1px solid ${
                      review.approved
                        ? 'rgba(220,38,38,0.2)'
                        : 'rgba(5,150,105,0.2)'
                    }`,
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {review.approved ? 'Unapprove' : 'Approve'}
                </button>
                <button
                  onClick={() => deleteReview(review.id)}
                  style={{
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid rgba(220,38,38,0.2)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create the admin reviews server page**

Create `app/admin/(protected)/reviews/page.tsx`:

```typescript
import { createServiceRoleClient } from '@/lib/supabase'
import ReviewsClient from '@/components/admin/ReviewsClient'

export const dynamic = 'force-dynamic'

export default async function AdminReviewsPage() {
  const supabase = createServiceRoleClient()

  const { data: reviews } = await supabase
    .from('reviews')
    .select(
      'id, rating, comment, approved, created_at, booking:bookings(guest_first_name, guest_last_name, room:rooms(name))',
    )
    .order('created_at', { ascending: false })

  return <ReviewsClient reviews={reviews ?? []} />
}
```

- [ ] **Step 4: Add Reviews link to the admin sidebar**

In `components/admin/AdminSidebar.tsx`, add `StarIcon` to the heroicons import:

```typescript
import {
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  Bars3Icon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  StarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
```

In the `NAV_ITEMS` array, add the Reviews entry after `Email`:

```typescript
  { label: 'Email', href: '/admin/email/settings', icon: EnvelopeIcon },
  { label: 'Reviews', href: '/admin/reviews', icon: StarIcon },
  { label: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon },
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/admin/\(protected\)/reviews app/api/admin/reviews components/admin/ReviewsClient.tsx components/admin/AdminSidebar.tsx
git commit -m "feat: add admin reviews page with approve and delete actions"
```

---

### Task 9: Homepage ReviewsSection reads approved reviews from DB

**Files:**
- Modify: `components/public/ReviewsSection.tsx`
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Update ReviewsSection to accept DB reviews as props**

Replace the entire contents of `components/public/ReviewsSection.tsx` with:

```typescript
interface Review {
  id: string
  rating: number
  comment: string | null
  booking: {
    guest_first_name: string
    guest_last_name: string
  } | null
}

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < count ? 'text-primary' : 'text-surface-high'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.958z" />
        </svg>
      ))}
    </div>
  )
}

export default function ReviewsSection({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null

  return (
    <section className="bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">
            What Our Guests Say
          </p>
          <h2 className="font-display font-extrabold text-on-surface text-3xl leading-tight">
            Why Choose Us?
          </h2>
          <p className="text-on-surface-variant font-body mt-2">
            We provide more than just a room — a community lifestyle designed for modern living.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-surface-lowest rounded-2xl p-6 border border-surface flex flex-col gap-4"
            >
              <StarRating count={review.rating} />
              {review.comment && (
                <blockquote className="text-on-surface-variant font-body text-sm leading-relaxed flex-1">
                  &ldquo;{review.comment}&rdquo;
                </blockquote>
              )}
              <p className="font-display font-semibold text-on-surface text-sm">
                — {review.booking?.guest_first_name} {review.booking?.guest_last_name?.charAt(0)}.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Fetch approved reviews in the homepage `getData` function**

In `app/(public)/page.tsx`, inside the `getData` function, add a reviews query to the parallel fetch:

```typescript
  const [roomsResult, settings, reviewsResult] = await Promise.all([
    supabase
      .from('rooms')
      .select('*, property:properties(*)')
      .eq('is_active', true)
      .order('name'),
    getSiteSettings(),
    supabase
      .from('reviews')
      .select('id, rating, comment, booking:bookings(guest_first_name, guest_last_name)')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(6),
  ])
```

Update the return statement in `getData` to include reviews:

```typescript
    return {
      properties: Array.from(propertyMap.values()),
      aboutText: settings?.about_text ?? DEFAULT_ABOUT,
      reviews: (reviewsResult.data ?? []) as Review[],
    }
```

Add a type alias above `getData`:

```typescript
type Review = {
  id: string
  rating: number
  comment: string | null
  booking: { guest_first_name: string; guest_last_name: string } | null
}
```

And update `HomePage` to pass reviews to the component — find `<ReviewsSection />` and replace with:

```typescript
      <ReviewsSection reviews={reviews} />
```

Update the destructuring at the top of `HomePage`:

```typescript
  const { properties, aboutText, reviews } = await getData()
```

Also update the catch fallback in `getData` to return `reviews: []`:

```typescript
  } catch {
    return { properties: [], aboutText: DEFAULT_ABOUT, reviews: [] }
  }
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the full test suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/public/ReviewsSection.tsx app/\(public\)/page.tsx
git commit -m "feat: homepage ReviewsSection now displays approved reviews from database"
```
