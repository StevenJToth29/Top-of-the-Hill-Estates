# Guest Booking Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-service `/booking/manage` page where guests can view their booking, cancel it (with auto-refund), or request date/guest-count modifications (flagged for admin review).

**Architecture:** Single server-rendered page at `/booking/manage` uses `booking_id` prefix + `guest_email` for identity. Cancellations execute immediately via a new guest-scoped API route. Modification requests are persisted to a new `booking_modification_requests` table and approved/rejected by admin via a new PATCH route. A configurable `cancellation_window_hours` field on `rooms` drives both cancel and modify cutoffs.

**Tech Stack:** Next.js App Router (server + client components), Supabase (service role), Stripe refunds, date-fns, Tailwind/existing design tokens.

---

## File Map

| File | Action |
|---|---|
| `supabase/migrations/007_guest_booking_management.sql` | New |
| `types/index.ts` | Modify |
| `lib/cancellation.ts` | Modify |
| `lib/availability.ts` | Modify |
| `app/api/admin/rooms/route.ts` | Modify |
| `components/admin/RoomForm.tsx` | Modify |
| `app/api/bookings/[id]/cancel/guest/route.ts` | New |
| `app/api/bookings/[id]/modify/route.ts` | New |
| `app/api/admin/bookings/[id]/modification-requests/[reqId]/route.ts` | New |
| `app/(public)/booking/manage/page.tsx` | New |
| `components/public/BookingManageView.tsx` | New |
| `components/public/BookingConfirmation.tsx` | Modify |
| `app/admin/(protected)/bookings/page.tsx` | Modify |
| `components/admin/BookingDetailPanel.tsx` | Modify |
| `__tests__/lib/cancellation.test.ts` | New |
| `__tests__/lib/availability.test.ts` | New |
| `__tests__/api/bookings-cancel-guest.test.ts` | New |
| `__tests__/api/bookings-modify.test.ts` | New |
| `__tests__/api/admin/modification-requests.test.ts` | New |

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/007_guest_booking_management.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/007_guest_booking_management.sql

-- Add configurable cancellation window to rooms (default 72 hours)
ALTER TABLE rooms
  ADD COLUMN cancellation_window_hours INT NOT NULL DEFAULT 72;

-- Stores guest-requested modification requests pending admin approval
CREATE TABLE booking_modification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  requested_check_in DATE NOT NULL,
  requested_check_out DATE NOT NULL,
  requested_guest_count INT NOT NULL,
  requested_total_nights INT NOT NULL,
  price_delta NUMERIC NOT NULL,  -- positive = guest owes more, negative = refund owed
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_modification_requests_updated_at
  BEFORE UPDATE ON booking_modification_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE booking_modification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on modification requests"
  ON booking_modification_requests
  USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies without errors. Verify with:
```bash
npx supabase db diff
```
Expected: no remaining diff.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_guest_booking_management.sql
git commit -m "feat: add cancellation_window_hours to rooms and booking_modification_requests table"
```

---

### Task 2: Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add `cancellation_window_hours` to the `Room` interface**

In `types/index.ts`, find the `Room` interface and add after `ical_export_token`:

```ts
  cancellation_window_hours: number
```

- [ ] **Step 2: Add the `BookingModificationRequest` interface**

After the `BookingFee` interface, add:

```ts
export interface BookingModificationRequest {
  id: string
  booking_id: string
  requested_check_in: string
  requested_check_out: string
  requested_guest_count: number
  requested_total_nights: number
  price_delta: number
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add cancellation_window_hours to Room type and BookingModificationRequest interface"
```

---

### Task 3: Update `lib/cancellation.ts`

**Files:**
- Modify: `lib/cancellation.ts`
- Create: `__tests__/lib/cancellation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/cancellation.test.ts`:

```ts
/** @jest-environment node */
import { calculateRefund, isWithinCancellationWindow } from '@/lib/cancellation'
import type { Booking } from '@/types'

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    room_id: 'room-1',
    booking_type: 'short_term',
    guest_first_name: 'Jane',
    guest_last_name: 'Smith',
    guest_email: 'jane@example.com',
    guest_phone: '5550001234',
    check_in: '2026-06-10',
    check_out: '2026-06-15',
    total_nights: 5,
    nightly_rate: 100,
    monthly_rate: 0,
    cleaning_fee: 50,
    security_deposit: 0,
    extra_guest_fee: 0,
    guest_count: 1,
    total_amount: 550,
    amount_paid: 550,
    amount_due_at_checkin: 0,
    stripe_payment_intent_id: null,
    stripe_session_id: null,
    status: 'confirmed',
    cancellation_reason: null,
    cancelled_at: null,
    refund_amount: null,
    ghl_contact_id: null,
    sms_consent: false,
    marketing_consent: false,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

describe('calculateRefund', () => {
  it('returns full refund when cancelled more than 7 days before check-in', () => {
    const booking = makeBooking({ check_in: '2026-06-20', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-10T12:00:00Z') // 10 days before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(500)
    expect(result.refund_percentage).toBe(100)
  })

  it('returns 50% refund when cancelled within 7 days but outside default 72h window', () => {
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-06T12:00:00Z') // 96h before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(250)
    expect(result.refund_percentage).toBe(50)
  })

  it('returns 0 refund when cancelled within default 72h window', () => {
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-08T12:00:00Z') // 48h before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(0)
    expect(result.refund_percentage).toBe(0)
  })

  it('respects a custom windowHours of 48', () => {
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    // 60h before — outside 48h window (50%) but inside 72h window (0%)
    const cancelledAt = new Date('2026-06-07T12:00:00Z')
    expect(calculateRefund(booking, cancelledAt, 48).refund_percentage).toBe(50)
    expect(calculateRefund(booking, cancelledAt, 72).refund_percentage).toBe(0)
  })

  it('includes windowHours value in policy_description', () => {
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-09T12:00:00Z') // 24h before
    expect(calculateRefund(booking, cancelledAt, 48).policy_description).toContain('48')
  })

  it('always returns 0 for long_term bookings regardless of timing', () => {
    const booking = makeBooking({ booking_type: 'long_term', check_in: '2026-06-20', amount_paid: 1000 })
    const cancelledAt = new Date('2026-05-01T12:00:00Z') // 50 days before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(0)
    expect(result.refund_percentage).toBe(0)
  })
})

describe('isWithinCancellationWindow', () => {
  it('returns true when check-in is within the window', () => {
    const booking = makeBooking({ check_in: '2026-06-10' })
    const now = new Date('2026-06-08T12:00:00Z') // 36h before
    expect(isWithinCancellationWindow(booking, now, 72)).toBe(true)
  })

  it('returns false when check-in is outside the window', () => {
    const booking = makeBooking({ check_in: '2026-06-10' })
    const now = new Date('2026-06-05T12:00:00Z') // 108h before
    expect(isWithinCancellationWindow(booking, now, 72)).toBe(false)
  })

  it('returns true at the exact boundary (hoursUntilCheckIn === windowHours)', () => {
    // check_in is 2026-06-10T00:00, now is 2026-06-07T00:00 => exactly 72h
    const booking = makeBooking({ check_in: '2026-06-10' })
    const now = new Date('2026-06-07T00:00:00Z')
    expect(isWithinCancellationWindow(booking, now, 72)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/lib/cancellation.test.ts --no-coverage
```

Expected: `isWithinCancellationWindow` tests fail with "not a function".

- [ ] **Step 3: Update `lib/cancellation.ts`**

Replace the entire file content:

```ts
import type { Booking, RefundResult } from '@/types'
import { differenceInHours } from 'date-fns/differenceInHours'
import { parseISO } from 'date-fns/parseISO'

/**
 * Calculates the refund amount based on the cancellation policy.
 *
 * Short-term policy:
 *   - Cancelled > 7 days before check-in → 100% refund
 *   - Cancelled > windowHours but within 7 days before check-in → 50% refund
 *   - Cancelled within windowHours of check-in → 0% refund
 *
 * Long-term policy:
 *   - Deposit is non-refundable → 0% refund always
 *
 * @param windowHours - Configurable inner cutoff (default 72). Set per room via cancellation_window_hours.
 */
export function calculateRefund(
  booking: Booking,
  cancelledAt: Date,
  windowHours = 72,
): RefundResult {
  const checkInDate = parseISO(booking.check_in)
  const hoursUntilCheckIn = differenceInHours(checkInDate, cancelledAt)

  if (booking.booking_type === 'long_term') {
    return {
      refund_amount: 0,
      refund_percentage: 0,
      policy_description: 'Long-term booking deposits are non-refundable.',
    }
  }

  if (hoursUntilCheckIn > 7 * 24) {
    return {
      refund_amount: booking.amount_paid,
      refund_percentage: 100,
      policy_description: 'Cancelled more than 7 days before check-in — full refund issued.',
    }
  }

  if (hoursUntilCheckIn > windowHours) {
    return {
      refund_amount: Math.round(booking.amount_paid * 0.5 * 100) / 100,
      refund_percentage: 50,
      policy_description: `Cancelled within 7 days but more than ${windowHours} hours before check-in — 50% refund issued.`,
    }
  }

  return {
    refund_amount: 0,
    refund_percentage: 0,
    policy_description: `Cancelled within ${windowHours} hours of check-in — no refund issued.`,
  }
}

/**
 * Returns true if check-in is within the cancellation window from now.
 * Used to gate both cancel and modify actions on the guest management page.
 */
export function isWithinCancellationWindow(
  booking: Booking,
  now: Date,
  windowHours = 72,
): boolean {
  const checkInDate = parseISO(booking.check_in)
  const hoursUntilCheckIn = differenceInHours(checkInDate, now)
  return hoursUntilCheckIn <= windowHours
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/lib/cancellation.test.ts --no-coverage
```

Expected: all 9 tests pass.

- [ ] **Step 5: Confirm existing tests still pass**

```bash
npx jest --no-coverage
```

Expected: all tests pass (the 2-arg signature still works via default param).

- [ ] **Step 6: Commit**

```bash
git add lib/cancellation.ts __tests__/lib/cancellation.test.ts
git commit -m "feat: add configurable windowHours to calculateRefund and isWithinCancellationWindow helper"
```

---

### Task 4: Add `isRoomAvailableExcluding` to `lib/availability.ts`

**Files:**
- Modify: `lib/availability.ts`
- Create: `__tests__/lib/availability.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/availability.test.ts`:

```ts
/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import { isRoomAvailableExcluding } from '@/lib/availability'

function mockSupabase(bookings: { check_in: string; check_out: string }[] = []) {
  const makeChain = (resolveValue: unknown) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockResolvedValue(resolveValue),
  })

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'bookings') return makeChain({ data: bookings, error: null })
      return makeChain({ data: [], error: null }) // ical_blocks
    }),
  })
}

describe('isRoomAvailableExcluding', () => {
  it('returns true when no other bookings overlap', async () => {
    mockSupabase([])
    const result = await isRoomAvailableExcluding('room-1', '2026-06-10', '2026-06-15', 'excl-id')
    expect(result).toBe(true)
  })

  it('returns false when another booking overlaps', async () => {
    mockSupabase([{ check_in: '2026-06-12', check_out: '2026-06-17' }])
    const result = await isRoomAvailableExcluding('room-1', '2026-06-10', '2026-06-15', 'excl-id')
    expect(result).toBe(false)
  })

  it('returns true when the only overlapping booking is the excluded one (mock returns empty)', async () => {
    // The DB query already filters out the excluded booking via .neq('id', excludeBookingId)
    // Simulated by mock returning empty array
    mockSupabase([])
    const result = await isRoomAvailableExcluding('room-1', '2026-06-10', '2026-06-15', 'booking-being-modified')
    expect(result).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest __tests__/lib/availability.test.ts --no-coverage
```

Expected: fails with "isRoomAvailableExcluding is not a function".

- [ ] **Step 3: Add `isRoomAvailableExcluding` to `lib/availability.ts`**

Append to the end of `lib/availability.ts` (after `isRoomAvailable`):

```ts
/**
 * Same as isRoomAvailable but excludes one booking from the blocked set.
 * Use this when checking availability for a modification of an existing booking
 * so the guest's own dates are not counted as blocked.
 */
export async function isRoomAvailableExcluding(
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId: string,
): Promise<boolean> {
  const supabase = createServiceRoleClient()

  const [{ data: bookings, error: bookingsError }, { data: icalBlocks, error: icalError }] =
    await Promise.all([
      supabase
        .from('bookings')
        .select('check_in, check_out')
        .eq('room_id', roomId)
        .in('status', ['confirmed', 'pending'])
        .neq('id', excludeBookingId)
        .lt('check_in', checkOut)
        .gte('check_out', checkIn),
      supabase
        .from('ical_blocks')
        .select('start_date, end_date')
        .eq('room_id', roomId)
        .lt('start_date', checkOut)
        .gte('end_date', checkIn),
    ])

  if (bookingsError) console.error('Error fetching bookings for availability:', bookingsError)
  if (icalError) console.error('Error fetching iCal blocks for availability:', icalError)

  const blocked = new Set<string>()
  for (const booking of bookings ?? []) addDateRangeToSet(blocked, booking.check_in, booking.check_out, checkOut)
  for (const block of icalBlocks ?? []) addDateRangeToSet(blocked, block.start_date, block.end_date, checkOut)

  if (blocked.size === 0) return true

  return eachDayOfInterval({
    start: parseISO(checkIn),
    end: addDays(parseISO(checkOut), -1),
  }).every((day) => !blocked.has(format(day, 'yyyy-MM-dd')))
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/lib/availability.test.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/availability.ts __tests__/lib/availability.test.ts
git commit -m "feat: add isRoomAvailableExcluding helper for modification availability checks"
```

---

### Task 5: Add `cancellation_window_hours` to Admin Rooms API and RoomForm

**Files:**
- Modify: `app/api/admin/rooms/route.ts`
- Modify: `components/admin/RoomForm.tsx`

- [ ] **Step 1: Update the POST handler in `app/api/admin/rooms/route.ts`**

In the `.insert({...})` block of `POST`, add `cancellation_window_hours` alongside the other fields:

```ts
cancellation_window_hours: Number(body.cancellation_window_hours ?? 72),
```

- [ ] **Step 2: Update the PATCH handler in `app/api/admin/rooms/route.ts`**

In the `.update({...})` block of `PATCH`, add:

```ts
cancellation_window_hours: Number(fields.cancellation_window_hours ?? 72),
```

- [ ] **Step 3: Add state and input to `components/admin/RoomForm.tsx`**

Add state after the `extraGuestFee` state line (around line 66):

```ts
const [cancellationWindowHours, setCancellationWindowHours] = useState(room?.cancellation_window_hours ?? 72)
```

Add to the `payload` object (around line 146, after `fees`):

```ts
cancellation_window_hours: cancellationWindowHours,
```

Add the form field inside the pricing/policy section of the form. Find the section that contains `cleaningFee` inputs and add below the extra guest fee field:

```tsx
<div>
  <label className={labelClass}>Cancellation Window (hours)</label>
  <input
    type="number"
    min={0}
    step={1}
    value={cancellationWindowHours}
    onChange={(e) => setCancellationWindowHours(Number(e.target.value))}
    className={inputClass}
  />
  <p className="text-xs text-on-surface-variant/60 mt-1">
    Guests cannot cancel or modify within this many hours of check-in. Default: 72.
  </p>
</div>
```

- [ ] **Step 4: Run the full test suite to confirm no regressions**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/rooms/route.ts components/admin/RoomForm.tsx
git commit -m "feat: add cancellation_window_hours field to room admin API and form"
```

---

### Task 6: Guest Cancel API

**Files:**
- Create: `app/api/bookings/[id]/cancel/guest/route.ts`
- Create: `__tests__/api/bookings-cancel-guest.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/bookings-cancel-guest.test.ts`:

```ts
/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))
jest.mock('@/lib/stripe', () => ({
  stripe: { refunds: { create: jest.fn().mockResolvedValue({}) } },
}))
jest.mock('@/lib/cancellation', () => ({
  calculateRefund: jest.fn().mockReturnValue({ refund_amount: 100, refund_percentage: 100, policy_description: 'Full refund.' }),
  isWithinCancellationWindow: jest.fn().mockReturnValue(false),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { calculateRefund, isWithinCancellationWindow } from '@/lib/cancellation'
import { POST } from '@/app/api/bookings/[id]/cancel/guest/route'

const mockParams = { params: { id: 'booking-1' } }

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/bookings/booking-1/cancel/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseBooking = {
  id: 'booking-1',
  guest_email: 'jane@example.com',
  status: 'confirmed',
  room_id: 'room-1',
  stripe_payment_intent_id: 'pi_test',
  amount_paid: 100,
  check_in: '2026-06-20',
  booking_type: 'short_term',
}

function setupMocks(booking = baseBooking, windowHours = 72) {
  const updateChain = {
    eq: jest.fn().mockResolvedValue({ error: null }),
  }
  const update = jest.fn().mockReturnValue(updateChain)

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: booking, error: null }),
          update,
        }
      }
      if (table === 'rooms') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { cancellation_window_hours: windowHours }, error: null }),
        }
      }
    }),
  })
  return { update }
}

describe('POST /api/bookings/[id]/cancel/guest', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if guest_email is missing', async () => {
    setupMocks()
    const res = await POST(makeRequest({}), mockParams as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 if booking not found', async () => {
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      })),
    })
    const res = await POST(makeRequest({ guest_email: 'jane@example.com' }), mockParams as never)
    expect(res.status).toBe(404)
  })

  it('returns 403 if email does not match', async () => {
    setupMocks()
    const res = await POST(makeRequest({ guest_email: 'wrong@example.com' }), mockParams as never)
    expect(res.status).toBe(403)
  })

  it('returns 400 if booking is not confirmed', async () => {
    setupMocks({ ...baseBooking, status: 'cancelled' })
    const res = await POST(makeRequest({ guest_email: 'jane@example.com' }), mockParams as never)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/current state/i)
  })

  it('returns 400 if within cancellation window', async () => {
    setupMocks()
    ;(isWithinCancellationWindow as jest.Mock).mockReturnValueOnce(true)
    const res = await POST(makeRequest({ guest_email: 'jane@example.com' }), mockParams as never)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/hours of check-in/i)
  })

  it('cancels the booking and issues a Stripe refund', async () => {
    const { update } = setupMocks()
    const res = await POST(makeRequest({ guest_email: 'jane@example.com' }), mockParams as never)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.refund_amount).toBe(100)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled', cancellation_reason: 'guest_requested' }))
    expect((stripe.refunds.create as jest.Mock)).toHaveBeenCalledWith({ payment_intent: 'pi_test', amount: 10000 })
  })

  it('does not issue Stripe refund when refund_amount is 0', async () => {
    setupMocks()
    ;(calculateRefund as jest.Mock).mockReturnValueOnce({ refund_amount: 0, refund_percentage: 0, policy_description: 'No refund.' })
    await POST(makeRequest({ guest_email: 'jane@example.com' }), mockParams as never)
    expect((stripe.refunds.create as jest.Mock)).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest __tests__/api/bookings-cancel-guest.test.ts --no-coverage
```

Expected: fails — route file does not exist.

- [ ] **Step 3: Create `app/api/bookings/[id]/cancel/guest/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { calculateRefund, isWithinCancellationWindow } from '@/lib/cancellation'
import type { Booking } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await request.json()) as { guest_email?: string }
    const { guest_email } = body

    if (!guest_email) {
      return NextResponse.json({ error: 'guest_email is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.guest_email.toLowerCase() !== guest_email.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'Booking cannot be cancelled in its current state' },
        { status: 400 },
      )
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('cancellation_window_hours')
      .eq('id', booking.room_id)
      .single()

    const windowHours: number = room?.cancellation_window_hours ?? 72
    const now = new Date()

    if (isWithinCancellationWindow(booking as Booking, now, windowHours)) {
      return NextResponse.json(
        { error: `Cancellations are not available within ${windowHours} hours of check-in` },
        { status: 400 },
      )
    }

    const refund = calculateRefund(booking as Booking, now, windowHours)

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: 'guest_requested',
        cancelled_at: now.toISOString(),
        refund_amount: refund.refund_amount,
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Failed to cancel booking:', updateError)
      return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
    }

    if (refund.refund_amount > 0 && booking.stripe_payment_intent_id) {
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: Math.round(refund.refund_amount * 100),
      })
    }

    return NextResponse.json({ success: true, refund_amount: refund.refund_amount })
  } catch (err) {
    console.error(`POST /api/bookings/${params.id}/cancel/guest error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/api/bookings-cancel-guest.test.ts --no-coverage
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/bookings/[id]/cancel/guest/route.ts __tests__/api/bookings-cancel-guest.test.ts
git commit -m "feat: add guest cancel API route with email verification and configurable window"
```

---

### Task 7: Guest Modify API

**Files:**
- Create: `app/api/bookings/[id]/modify/route.ts`
- Create: `__tests__/api/bookings-modify.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/bookings-modify.test.ts`:

```ts
/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))
jest.mock('@/lib/cancellation', () => ({
  isWithinCancellationWindow: jest.fn().mockReturnValue(false),
}))
jest.mock('@/lib/availability', () => ({
  isRoomAvailableExcluding: jest.fn().mockResolvedValue(true),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import { isWithinCancellationWindow } from '@/lib/cancellation'
import { isRoomAvailableExcluding } from '@/lib/availability'
import { POST } from '@/app/api/bookings/[id]/modify/route'

const mockParams = { params: { id: 'booking-1' } }

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/bookings/booking-1/modify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseBooking = {
  id: 'booking-1',
  guest_email: 'jane@example.com',
  status: 'confirmed',
  room_id: 'room-1',
  booking_type: 'short_term',
  total_amount: 550,
  nightly_rate: 100,
  monthly_rate: 0,
  cleaning_fee: 50,
  security_deposit: 0,
  extra_guest_fee: 0,
  check_in: '2026-06-10',
  check_out: '2026-06-15',
  room: {
    nightly_rate: 100,
    monthly_rate: 0,
    cleaning_fee: 50,
    security_deposit: 0,
    extra_guest_fee: 0,
    guest_capacity: 4,
    minimum_nights_short_term: 1,
    minimum_nights_long_term: 30,
    cancellation_window_hours: 72,
  },
}

const validBody = {
  guest_email: 'jane@example.com',
  check_in: '2026-07-01',
  check_out: '2026-07-05',
  guest_count: 2,
}

function setupMocks(booking = baseBooking, existingRequest: unknown = null) {
  const insertChain = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'req-1' }, error: null }),
  }

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: booking, error: null }),
        }
      }
      if (table === 'booking_modification_requests') {
        if (existingRequest) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: existingRequest, error: null }),
            insert: jest.fn().mockReturnValue(insertChain),
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          insert: jest.fn().mockReturnValue(insertChain),
        }
      }
      if (table === 'booking_fees') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
    }),
  })
}

describe('POST /api/bookings/[id]/modify', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if required fields are missing', async () => {
    setupMocks()
    const res = await POST(makeRequest({ guest_email: 'jane@example.com' }), mockParams as never)
    expect(res.status).toBe(400)
  })

  it('returns 403 if email does not match', async () => {
    setupMocks()
    const res = await POST(makeRequest({ ...validBody, guest_email: 'other@example.com' }), mockParams as never)
    expect(res.status).toBe(403)
  })

  it('returns 400 if booking is not confirmed', async () => {
    setupMocks({ ...baseBooking, status: 'cancelled' })
    const res = await POST(makeRequest(validBody), mockParams as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 if within cancellation window', async () => {
    setupMocks()
    ;(isWithinCancellationWindow as jest.Mock).mockReturnValueOnce(true)
    const res = await POST(makeRequest(validBody), mockParams as never)
    expect(res.status).toBe(400)
  })

  it('returns 409 if a pending modification request already exists', async () => {
    setupMocks(baseBooking, { id: 'req-existing' })
    const res = await POST(makeRequest(validBody), mockParams as never)
    expect(res.status).toBe(409)
  })

  it('returns 400 if check_out is not after check_in', async () => {
    setupMocks()
    const res = await POST(makeRequest({ ...validBody, check_in: '2026-07-05', check_out: '2026-07-01' }), mockParams as never)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/after check-in/i)
  })

  it('returns 409 if room is not available for the new dates', async () => {
    setupMocks()
    ;(isRoomAvailableExcluding as jest.Mock).mockResolvedValueOnce(false)
    const res = await POST(makeRequest(validBody), mockParams as never)
    expect(res.status).toBe(409)
  })

  it('returns 200 with price_delta and request_id on success', async () => {
    setupMocks()
    const res = await POST(makeRequest(validBody), mockParams as never)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(typeof data.price_delta).toBe('number')
    expect(data.request_id).toBe('req-1')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest __tests__/api/bookings-modify.test.ts --no-coverage
```

Expected: fails — route does not exist.

- [ ] **Step 3: Create `app/api/bookings/[id]/modify/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { isWithinCancellationWindow } from '@/lib/cancellation'
import { isRoomAvailableExcluding } from '@/lib/availability'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Booking } from '@/types'

interface ModifyBody {
  guest_email: string
  check_in: string
  check_out: string
  guest_count: number
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await request.json()) as Partial<ModifyBody>
    const { guest_email, check_in, check_out, guest_count } = body

    if (!guest_email || !check_in || !check_out || !guest_count) {
      return NextResponse.json(
        { error: 'guest_email, check_in, check_out, and guest_count are required' },
        { status: 400 },
      )
    }

    const supabase = createServiceRoleClient()

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(
        '*, room:rooms(nightly_rate, monthly_rate, cleaning_fee, security_deposit, extra_guest_fee, guest_capacity, minimum_nights_short_term, minimum_nights_long_term, cancellation_window_hours)',
      )
      .eq('id', params.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.guest_email.toLowerCase() !== guest_email.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Only confirmed bookings can be modified' }, { status: 400 })
    }

    const room = booking.room
    const windowHours: number = room?.cancellation_window_hours ?? 72
    const now = new Date()

    if (isWithinCancellationWindow(booking as Booking, now, windowHours)) {
      return NextResponse.json(
        { error: `Modifications are not available within ${windowHours} hours of check-in` },
        { status: 400 },
      )
    }

    // Reject if a pending request already exists
    const { data: existingRequest } = await supabase
      .from('booking_modification_requests')
      .select('id')
      .eq('booking_id', params.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A pending modification request already exists for this booking' },
        { status: 409 },
      )
    }

    // Validate dates
    const totalNights = differenceInCalendarDays(parseISO(check_out), parseISO(check_in))

    if (totalNights <= 0) {
      return NextResponse.json({ error: 'Check-out must be after check-in' }, { status: 400 })
    }

    const minNights =
      booking.booking_type === 'long_term'
        ? (room?.minimum_nights_long_term ?? 30)
        : (room?.minimum_nights_short_term ?? 1)

    if (totalNights < minNights) {
      return NextResponse.json(
        { error: `Minimum stay is ${minNights} night${minNights !== 1 ? 's' : ''}` },
        { status: 400 },
      )
    }

    const safeGuestCount = Number(guest_count)
    if (safeGuestCount < 1 || safeGuestCount > (room?.guest_capacity ?? 99)) {
      return NextResponse.json({ error: 'Invalid guest count' }, { status: 400 })
    }

    // Availability check — exclude the current booking's own dates
    const available = await isRoomAvailableExcluding(booking.room_id, check_in, check_out, params.id)
    if (!available) {
      return NextResponse.json(
        { error: 'Room is not available for the requested dates' },
        { status: 409 },
      )
    }

    // Compute new total using room's current rates + original fee snapshot
    const { data: bookingFees } = await supabase
      .from('booking_fees')
      .select('amount')
      .eq('booking_id', params.id)
    const genericFeesTotal = (bookingFees ?? []).reduce(
      (sum: number, f: { amount: number }) => sum + Number(f.amount),
      0,
    )

    const extraGuests = Math.max(0, safeGuestCount - 1)
    const extraGuestFee: number = room?.extra_guest_fee ?? 0
    let newTotal: number

    if (booking.booking_type === 'short_term') {
      const extraGuestTotal = extraGuests * extraGuestFee * totalNights
      newTotal =
        totalNights * (room?.nightly_rate ?? booking.nightly_rate) +
        (room?.cleaning_fee ?? booking.cleaning_fee ?? 0) +
        extraGuestTotal +
        genericFeesTotal
    } else {
      const extraGuestTotal = extraGuests * extraGuestFee
      newTotal =
        (room?.monthly_rate ?? booking.monthly_rate) +
        (room?.security_deposit ?? booking.security_deposit ?? 0) +
        extraGuestTotal +
        genericFeesTotal
    }

    const priceDelta = Math.round((newTotal - booking.total_amount) * 100) / 100

    const { data: modRequest, error: insertError } = await supabase
      .from('booking_modification_requests')
      .insert({
        booking_id: params.id,
        requested_check_in: check_in,
        requested_check_out: check_out,
        requested_guest_count: safeGuestCount,
        requested_total_nights: totalNights,
        price_delta: priceDelta,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError || !modRequest) {
      console.error('Failed to insert modification request:', insertError)
      return NextResponse.json({ error: 'Failed to submit modification request' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      price_delta: priceDelta,
      new_total: newTotal,
      request_id: modRequest.id,
    })
  } catch (err) {
    console.error(`POST /api/bookings/${params.id}/modify error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/api/bookings-modify.test.ts --no-coverage
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/bookings/[id]/modify/route.ts __tests__/api/bookings-modify.test.ts
git commit -m "feat: add guest modify API route with availability check and pending-request guard"
```

---

### Task 8: Admin Modification-Requests API

**Files:**
- Create: `app/api/admin/bookings/[id]/modification-requests/[reqId]/route.ts`
- Create: `__tests__/api/admin/modification-requests.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/admin/modification-requests.test.ts`:

```ts
/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { PATCH } from '@/app/api/admin/bookings/[id]/modification-requests/[reqId]/route'

const mockParams = { params: { id: 'booking-1', reqId: 'req-1' } }

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/bookings/booking-1/modification-requests/req-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const pendingRequest = {
  id: 'req-1',
  booking_id: 'booking-1',
  status: 'pending',
  requested_check_in: '2026-07-01',
  requested_check_out: '2026-07-05',
  requested_total_nights: 4,
  requested_guest_count: 2,
}

function setupMocks(modRequest = pendingRequest, bookingUpdateError: unknown = null) {
  const authedUser = { id: 'admin-1' }

  const bookingUpdateChain = { eq: jest.fn().mockResolvedValue({ error: bookingUpdateError }) }
  const bookingUpdate = jest.fn().mockReturnValue(bookingUpdateChain)

  const reqUpdateChain = { eq: jest.fn().mockResolvedValue({ error: null }) }
  const reqUpdate = jest.fn().mockReturnValue(reqUpdateChain)

  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: authedUser }, error: null }) },
  })

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'booking_modification_requests') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: modRequest, error: null }),
          update: reqUpdate,
        }
      }
      if (table === 'bookings') {
        return { update: bookingUpdate }
      }
    }),
  })

  return { bookingUpdate, reqUpdate }
}

describe('PATCH /api/admin/bookings/[id]/modification-requests/[reqId]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error('no session') }) },
    })
    const res = await PATCH(makeRequest({ action: 'approve' }), mockParams as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 if action is invalid', async () => {
    setupMocks()
    const res = await PATCH(makeRequest({ action: 'delete' }), mockParams as never)
    expect(res.status).toBe(400)
  })

  it('approve: updates booking dates and marks request approved', async () => {
    const { bookingUpdate, reqUpdate } = setupMocks()
    const res = await PATCH(makeRequest({ action: 'approve', admin_note: 'Approved!' }), mockParams as never)
    expect(res.status).toBe(200)
    expect(bookingUpdate).toHaveBeenCalledWith({
      check_in: '2026-07-01',
      check_out: '2026-07-05',
      total_nights: 4,
      guest_count: 2,
    })
    expect(reqUpdate).toHaveBeenCalledWith({ status: 'approved', admin_note: 'Approved!' })
  })

  it('reject: updates request to rejected without touching booking', async () => {
    const { bookingUpdate, reqUpdate } = setupMocks()
    const res = await PATCH(makeRequest({ action: 'reject', admin_note: 'Dates not available.' }), mockParams as never)
    expect(res.status).toBe(200)
    expect(bookingUpdate).not.toHaveBeenCalled()
    expect(reqUpdate).toHaveBeenCalledWith({ status: 'rejected', admin_note: 'Dates not available.' })
  })

  it('returns 400 if request is not pending', async () => {
    setupMocks({ ...pendingRequest, status: 'approved' })
    const res = await PATCH(makeRequest({ action: 'approve' }), mockParams as never)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest __tests__/api/admin/modification-requests.test.ts --no-coverage
```

Expected: fails — route does not exist.

- [ ] **Step 3: Create the route**

Create `app/api/admin/bookings/[id]/modification-requests/[reqId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; reqId: string } },
) {
  try {
    const serverClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await serverClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { action?: string; admin_note?: string }
    const { action, admin_note } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: modRequest, error: fetchError } = await supabase
      .from('booking_modification_requests')
      .select('*')
      .eq('id', params.reqId)
      .eq('booking_id', params.id)
      .single()

    if (fetchError || !modRequest) {
      return NextResponse.json({ error: 'Modification request not found' }, { status: 404 })
    }

    if (modRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Modification request is no longer pending' }, { status: 400 })
    }

    if (action === 'approve') {
      const { error: bookingUpdateError } = await supabase
        .from('bookings')
        .update({
          check_in: modRequest.requested_check_in,
          check_out: modRequest.requested_check_out,
          total_nights: modRequest.requested_total_nights,
          guest_count: modRequest.requested_guest_count,
        })
        .eq('id', params.id)

      if (bookingUpdateError) {
        console.error('Failed to update booking on approve:', bookingUpdateError)
        return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
      }
    }

    const { error: reqUpdateError } = await supabase
      .from('booking_modification_requests')
      .update({ status: action === 'approve' ? 'approved' : 'rejected', admin_note: admin_note ?? null })
      .eq('id', params.reqId)

    if (reqUpdateError) {
      console.error('Failed to update modification request:', reqUpdateError)
      return NextResponse.json({ error: 'Failed to update modification request' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(
      `PATCH /api/admin/bookings/${params.id}/modification-requests/${params.reqId} error:`,
      err,
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/api/admin/modification-requests.test.ts --no-coverage
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/bookings/[id]/modification-requests/[reqId]/route.ts __tests__/api/admin/modification-requests.test.ts
git commit -m "feat: add admin modification-requests PATCH route for approve/reject"
```

---

### Task 9: `BookingManageView` Client Component

**Files:**
- Create: `components/public/BookingManageView.tsx`

- [ ] **Step 1: Create the component**

Create `components/public/BookingManageView.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import DatePicker from '@/components/public/DatePicker'
import type { Booking, Room, Property, BookingModificationRequest } from '@/types'

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
function fmtCurrency(n: number) {
  return currencyFmt.format(n)
}
function fmtDate(iso: string) {
  try {
    return format(parseISO(iso + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
  } catch {
    return iso
  }
}

interface Props {
  booking: Booking & { room: Room & { property: Property } }
  windowHours: number
  withinWindow: boolean
  refundAmount: number
  refundPercentage: number
  policyDescription: string
  latestRequest: BookingModificationRequest | null
  blockedDates: string[]
  genericFeesTotal: number
}

export default function BookingManageView({
  booking,
  windowHours,
  withinWindow,
  refundAmount,
  refundPercentage,
  policyDescription,
  latestRequest,
  blockedDates,
  genericFeesTotal,
}: Props) {
  const room = booking.room
  const property = room.property

  const isActive = booking.status === 'confirmed'
  const isCancelled = booking.status === 'cancelled'
  const isCompleted = booking.status === 'completed'

  // Cancel state
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSuccess, setCancelSuccess] = useState(false)
  const [cancelledRefund, setCancelledRefund] = useState<number | null>(null)

  // Modify state
  const [modCheckIn, setModCheckIn] = useState(booking.check_in)
  const [modCheckOut, setModCheckOut] = useState(booking.check_out)
  const [modGuestCount, setModGuestCount] = useState(booking.guest_count)
  const [modLoading, setModLoading] = useState(false)
  const [modError, setModError] = useState<string | null>(null)
  const [modSuccess, setModSuccess] = useState(false)
  const [modPriceDelta, setModPriceDelta] = useState<number | null>(null)
  const [modNewTotal, setModNewTotal] = useState<number | null>(null)

  // Client-side price delta preview
  const totalNightsPreview = differenceInCalendarDays(parseISO(modCheckOut), parseISO(modCheckIn))
  const extraGuests = Math.max(0, modGuestCount - 1)
  const extraGuestFeePerNight = room.extra_guest_fee ?? 0

  let previewTotal = 0
  if (totalNightsPreview > 0) {
    if (booking.booking_type === 'short_term') {
      previewTotal =
        totalNightsPreview * (room.nightly_rate ?? 0) +
        (room.cleaning_fee ?? 0) +
        extraGuests * extraGuestFeePerNight * totalNightsPreview +
        genericFeesTotal
    } else {
      previewTotal =
        (room.monthly_rate ?? 0) +
        (room.security_deposit ?? 0) +
        extraGuests * extraGuestFeePerNight +
        genericFeesTotal
    }
  }
  const previewDelta = previewTotal - booking.total_amount

  async function handleCancel() {
    setCancelLoading(true)
    setCancelError(null)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_email: booking.guest_email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to cancel booking')
      setCancelSuccess(true)
      setCancelledRefund(data.refund_amount)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCancelLoading(false)
    }
  }

  async function handleModify(e: React.FormEvent) {
    e.preventDefault()
    setModLoading(true)
    setModError(null)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_email: booking.guest_email,
          check_in: modCheckIn,
          check_out: modCheckOut,
          guest_count: modGuestCount,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit modification')
      setModSuccess(true)
      setModPriceDelta(data.price_delta)
      setModNewTotal(data.new_total)
    } catch (err) {
      setModError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setModLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Booking summary */}
      <div className="bg-surface-container rounded-2xl p-6 shadow-[0_8px_40px_rgba(45,212,191,0.06)]">
        <h1 className="font-display text-2xl font-bold text-primary mb-4">Your Booking</h1>
        <div className="space-y-1 font-body text-on-surface-variant text-sm">
          <p className="text-on-surface font-semibold text-base">{room.name}</p>
          <p>{property.name}</p>
          <p>
            {property.address}, {property.city}, {property.state}
          </p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-xs text-on-surface-variant mb-0.5">Check-in</p>
              <p className="text-on-surface font-medium">{fmtDate(booking.check_in)}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant mb-0.5">Check-out</p>
              <p className="text-on-surface font-medium">{fmtDate(booking.check_out)}</p>
            </div>
          </div>
          <p className="mt-2">
            Guests: <span className="text-on-surface">{booking.guest_count}</span>
          </p>
          <p>
            Total paid:{' '}
            <span className="text-on-surface font-semibold">{fmtCurrency(booking.amount_paid)}</span>
          </p>
        </div>
        <a
          href={`/booking/confirmation?booking_id=${booking.id}&guest_email=${encodeURIComponent(booking.guest_email)}`}
          className="inline-block mt-4 text-sm text-secondary hover:underline font-body"
        >
          View confirmation
        </a>
      </div>

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="bg-error/10 rounded-2xl p-5 font-body">
          <p className="text-error font-semibold">This reservation has been cancelled.</p>
          {booking.refund_amount != null && booking.refund_amount > 0 && (
            <p className="text-on-surface-variant text-sm mt-1">
              Refund issued: {fmtCurrency(booking.refund_amount)}
            </p>
          )}
        </div>
      )}

      {/* Completed banner */}
      {isCompleted && (
        <div className="bg-primary/10 rounded-2xl p-5 font-body">
          <p className="text-primary font-semibold">
            This stay has been completed. We hope you enjoyed it!
          </p>
        </div>
      )}

      {/* Cancel success */}
      {cancelSuccess && (
        <div className="bg-secondary/10 rounded-2xl p-5 font-body">
          <p className="text-secondary font-semibold">Your reservation has been cancelled.</p>
          {cancelledRefund != null && cancelledRefund > 0 ? (
            <p className="text-on-surface-variant text-sm mt-1">
              A refund of {fmtCurrency(cancelledRefund)} has been issued to your original payment
              method.
            </p>
          ) : (
            <p className="text-on-surface-variant text-sm mt-1">
              No refund applies per the cancellation policy.
            </p>
          )}
        </div>
      )}

      {/* Within-window notice */}
      {isActive && withinWindow && !cancelSuccess && (
        <div className="bg-surface-highest/40 rounded-2xl p-5 font-body">
          <p className="text-on-surface-variant text-sm">
            Modifications and cancellations are no longer available within {windowHours} hours of
            check-in. Please contact us directly if you need assistance.
          </p>
        </div>
      )}

      {/* Actions — confirmed bookings outside the window */}
      {isActive && !withinWindow && !cancelSuccess && (
        <>
          {/* Cancel section */}
          <div className="bg-surface-container rounded-2xl p-6 space-y-3">
            <h2 className="font-display text-lg font-semibold text-primary">Cancellation</h2>
            <p className="font-body text-on-surface-variant text-sm">{policyDescription}</p>
            {refundPercentage > 0 ? (
              <p className="font-body text-sm text-on-surface-variant">
                Expected refund:{' '}
                <span className="text-on-surface font-semibold">{fmtCurrency(refundAmount)}</span>{' '}
                ({refundPercentage}%)
              </p>
            ) : (
              <p className="font-body text-sm text-on-surface-variant">
                No refund applies at this time.
              </p>
            )}
            {cancelError && <p className="text-error text-sm font-body">{cancelError}</p>}
            {!cancelConfirm ? (
              <button
                onClick={() => setCancelConfirm(true)}
                className="rounded-xl bg-error/20 px-4 py-2 text-sm font-semibold text-error hover:bg-error/30 transition-colors font-body"
              >
                Cancel Reservation
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-on-surface-variant font-body">
                  Are you sure? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    className="rounded-xl bg-error/20 px-4 py-2 text-sm font-semibold text-error hover:bg-error/30 transition-colors disabled:opacity-50 font-body"
                  >
                    {cancelLoading ? 'Cancelling…' : 'Yes, Cancel'}
                  </button>
                  <button
                    onClick={() => setCancelConfirm(false)}
                    className="rounded-xl bg-surface-highest/40 px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-highest/60 transition-colors font-body"
                  >
                    Keep Booking
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modify section */}
          {modSuccess ? (
            <div className="bg-secondary/10 rounded-2xl p-6 font-body">
              <h2 className="font-display text-lg font-semibold text-primary mb-2">
                Modification Requested
              </h2>
              <p className="text-on-surface-variant text-sm">
                Your request has been submitted. The host will review and be in touch soon.
              </p>
              {modPriceDelta !== null && modPriceDelta > 0 && (
                <p className="text-sm text-on-surface-variant mt-2">
                  The new total would be {fmtCurrency(modNewTotal!)} —{' '}
                  {fmtCurrency(modPriceDelta)} more than paid. The host will contact you about the
                  difference.
                </p>
              )}
              {modPriceDelta !== null && modPriceDelta < 0 && (
                <p className="text-sm text-on-surface-variant mt-2">
                  The new total would be {fmtCurrency(modNewTotal!)} — you may be eligible for a{' '}
                  {fmtCurrency(Math.abs(modPriceDelta))} refund if approved.
                </p>
              )}
            </div>
          ) : latestRequest?.status === 'pending' ? (
            <div className="bg-surface-container rounded-2xl p-6 font-body">
              <h2 className="font-display text-lg font-semibold text-primary mb-2">
                Pending Modification Request
              </h2>
              <p className="text-on-surface-variant text-sm mb-3">
                Submitted on {format(parseISO(latestRequest.created_at), 'MMM d, yyyy')}. The host
                will be in touch soon.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-on-surface-variant mb-0.5">Requested check-in</p>
                  <p className="text-on-surface">{fmtDate(latestRequest.requested_check_in)}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant mb-0.5">Requested check-out</p>
                  <p className="text-on-surface">{fmtDate(latestRequest.requested_check_out)}</p>
                </div>
              </div>
              <p className="text-sm text-on-surface-variant mt-2">
                Guests: {latestRequest.requested_guest_count}
              </p>
              {latestRequest.admin_note && (
                <p className="text-sm text-on-surface-variant mt-2 italic">
                  {latestRequest.admin_note}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-surface-container rounded-2xl p-6">
              <h2 className="font-display text-lg font-semibold text-primary mb-4">
                Request a Change
              </h2>
              {latestRequest?.status === 'rejected' && (
                <div className="mb-4 p-3 bg-error/10 rounded-xl text-sm font-body">
                  <p className="text-error font-semibold">
                    Your previous modification request was not approved.
                  </p>
                  {latestRequest.admin_note && (
                    <p className="text-on-surface-variant mt-1">{latestRequest.admin_note}</p>
                  )}
                </div>
              )}
              <form onSubmit={handleModify} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DatePicker
                    label="New Check-in"
                    value={modCheckIn}
                    onChange={setModCheckIn}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    blockedDates={blockedDates}
                  />
                  <DatePicker
                    label="New Check-out"
                    value={modCheckOut}
                    onChange={setModCheckOut}
                    min={modCheckIn || format(new Date(), 'yyyy-MM-dd')}
                    blockedDates={blockedDates}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
                    Guests
                  </label>
                  <select
                    value={modGuestCount}
                    onChange={(e) => setModGuestCount(Number(e.target.value))}
                    className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 font-body"
                  >
                    {Array.from({ length: room.guest_capacity }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'guest' : 'guests'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price preview */}
                {totalNightsPreview > 0 && (
                  <div className="rounded-xl bg-surface-highest/40 p-4 text-sm font-body space-y-1">
                    <p className="text-on-surface-variant">
                      Estimated new total:{' '}
                      <span className="text-on-surface font-semibold">
                        {fmtCurrency(previewTotal)}
                      </span>
                    </p>
                    {previewDelta > 0 && (
                      <p className="text-secondary text-xs">
                        {fmtCurrency(previewDelta)} more than currently paid — the host will contact
                        you about the difference if approved.
                      </p>
                    )}
                    {previewDelta < 0 && (
                      <p className="text-primary text-xs">
                        You may be eligible for a {fmtCurrency(Math.abs(previewDelta))} refund if
                        this change is approved.
                      </p>
                    )}
                    {previewDelta === 0 && (
                      <p className="text-on-surface-variant text-xs">No price change.</p>
                    )}
                  </div>
                )}

                {modError && <p className="text-error text-sm font-body">{modError}</p>}
                <button
                  type="submit"
                  disabled={modLoading || totalNightsPreview <= 0}
                  className="w-full bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold font-body disabled:opacity-50"
                >
                  {modLoading ? 'Submitting…' : 'Request Change'}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Confirm TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/public/BookingManageView.tsx
git commit -m "feat: add BookingManageView client component with cancel and modify flows"
```

---

### Task 10: `/booking/manage` Page

**Files:**
- Create: `app/(public)/booking/manage/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/(public)/booking/manage/page.tsx`:

```tsx
import { createServiceRoleClient } from '@/lib/supabase'
import { isWithinCancellationWindow, calculateRefund } from '@/lib/cancellation'
import { getBlockedDatesForRoom } from '@/lib/availability'
import { addYears, addDays, eachDayOfInterval, parseISO, format } from 'date-fns'
import BookingManageView from '@/components/public/BookingManageView'
import type { Booking, Room, Property, BookingModificationRequest } from '@/types'

interface PageProps {
  searchParams: { booking_id?: string; guest_email?: string }
}

export default async function BookingManagePage({ searchParams }: PageProps) {
  const { booking_id, guest_email } = searchParams

  if (!booking_id || !guest_email) {
    return (
      <main className="min-h-screen bg-background py-16 px-4">
        <LookupForm error={null} />
      </main>
    )
  }

  const supabase = createServiceRoleClient()
  // Accept either the full UUID or the 8-char display prefix
  const prefix = booking_id.toLowerCase().slice(0, 8)

  const { data: bookingRaw } = await supabase
    .from('bookings')
    .select('*, room:rooms(*, property:properties(*))')
    .filter('id::text', 'ilike', `${prefix}%`)
    .ilike('guest_email', guest_email)
    .limit(1)
    .maybeSingle()

  if (!bookingRaw || !bookingRaw.room || !bookingRaw.room.property) {
    return (
      <main className="min-h-screen bg-background py-16 px-4">
        <LookupForm error="We couldn't find a booking with those details. Please check your confirmation email." />
      </main>
    )
  }

  const booking = bookingRaw as unknown as Booking & { room: Room & { property: Property } }
  const windowHours: number = booking.room.cancellation_window_hours ?? 72
  const now = new Date()
  const withinWindow = isWithinCancellationWindow(booking, now, windowHours)
  const refund = calculateRefund(booking, now, windowHours)

  // Fetch the most recent pending or rejected modification request
  const { data: modRequests } = await supabase
    .from('booking_modification_requests')
    .select('*')
    .eq('booking_id', booking.id)
    .in('status', ['pending', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(1)

  const latestRequest = (modRequests?.[0] ?? null) as BookingModificationRequest | null

  // Blocked dates for the modify date pickers (exclude current booking's own dates)
  let blockedDates: string[] = []
  if (!withinWindow && booking.status === 'confirmed') {
    const today = format(now, 'yyyy-MM-dd')
    const twoYearsOut = format(addYears(now, 2), 'yyyy-MM-dd')
    const allBlocked = await getBlockedDatesForRoom(booking.room_id, today, twoYearsOut)
    const currentDates = new Set(
      eachDayOfInterval({
        start: parseISO(booking.check_in),
        end: addDays(parseISO(booking.check_out), -1),
      }).map((d) => format(d, 'yyyy-MM-dd')),
    )
    blockedDates = allBlocked.filter((d) => !currentDates.has(d))
  }

  // Original fee snapshot total (used for client-side price preview)
  const { data: bookingFees } = await supabase
    .from('booking_fees')
    .select('amount')
    .eq('booking_id', booking.id)
  const genericFeesTotal = (bookingFees ?? []).reduce(
    (sum: number, f: { amount: number }) => sum + Number(f.amount),
    0,
  )

  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <BookingManageView
        booking={booking}
        windowHours={windowHours}
        withinWindow={withinWindow}
        refundAmount={refund.refund_amount}
        refundPercentage={refund.refund_percentage}
        policyDescription={refund.policy_description}
        latestRequest={latestRequest}
        blockedDates={blockedDates}
        genericFeesTotal={genericFeesTotal}
      />
    </main>
  )
}

function LookupForm({ error }: { error: string | null }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-surface-container rounded-2xl p-8 shadow-[0_8px_40px_rgba(45,212,191,0.06)]">
        <h1 className="font-display text-3xl font-bold text-primary mb-2">Manage Your Booking</h1>
        <p className="text-on-surface-variant font-body mb-6 text-sm">
          Enter the booking reference from your confirmation email and the email address you used to
          book.
        </p>
        {error && <p className="text-error text-sm mb-4 font-body">{error}</p>}
        <form method="GET" action="/booking/manage" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
              Booking Reference
            </label>
            <input
              name="booking_id"
              type="text"
              required
              placeholder="e.g. A1B2C3D4"
              className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50 font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
              Email Address
            </label>
            <input
              name="guest_email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold font-body"
          >
            Find My Booking
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Confirm TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(public\)/booking/manage/page.tsx
git commit -m "feat: add /booking/manage page with lookup form and management view"
```

---

### Task 11: Add "Manage your booking" Link to Confirmation Page

**Files:**
- Modify: `components/public/BookingConfirmation.tsx`

- [ ] **Step 1: Add the link**

In `components/public/BookingConfirmation.tsx`, find the cancellation policy section (around line 163) and add a new section immediately after it, before the contact section:

```tsx
      <section className="mb-6">
        <a
          href={`/booking/manage?booking_id=${booking.id}&guest_email=${encodeURIComponent(booking.guest_email)}`}
          className="inline-block bg-surface-container rounded-xl px-6 py-3 text-sm font-semibold font-body text-secondary hover:bg-surface-container/80 transition-colors"
        >
          Manage your booking
        </a>
      </section>
```

- [ ] **Step 2: Confirm TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/public/BookingConfirmation.tsx
git commit -m "feat: add 'Manage your booking' link to booking confirmation page"
```

---

### Task 12: Admin UI — Modification Requests in BookingDetailPanel

**Files:**
- Modify: `app/admin/(protected)/bookings/page.tsx`
- Modify: `components/admin/BookingDetailPanel.tsx`

- [ ] **Step 1: Fetch modification requests in the admin bookings page**

In `app/admin/(protected)/bookings/page.tsx`, update the selected-booking fetch block. Find:

```ts
  let selectedBooking: (Booking & { room: Room & { property: Property } }) | null = null
  if (searchParams.id) {
    const { data } = await supabase
      .from('bookings')
      .select('*, room:rooms(*, property:properties(*))')
      .eq('id', searchParams.id)
      .single()
    selectedBooking = data
  }
```

Replace with:

```ts
  let selectedBooking: (Booking & { room: Room & { property: Property } }) | null = null
  let selectedBookingModRequests: BookingModificationRequest[] = []
  if (searchParams.id) {
    const [{ data: bookingData }, { data: modData }] = await Promise.all([
      supabase
        .from('bookings')
        .select('*, room:rooms(*, property:properties(*))')
        .eq('id', searchParams.id)
        .single(),
      supabase
        .from('booking_modification_requests')
        .select('*')
        .eq('booking_id', searchParams.id)
        .order('created_at', { ascending: false }),
    ])
    selectedBooking = bookingData
    selectedBookingModRequests = (modData ?? []) as BookingModificationRequest[]
  }
```

Also add the import at the top of the file:

```ts
import type { Booking, Room, Property, BookingModificationRequest } from '@/types'
```

And update the `BookingDetailPanel` usage:

```tsx
        {selectedBooking && (
          <BookingDetailPanel
            booking={selectedBooking}
            modificationRequests={selectedBookingModRequests}
          />
        )}
```

- [ ] **Step 2: Update `BookingDetailPanel` to accept and display modification requests**

In `components/admin/BookingDetailPanel.tsx`, update the `Props` type:

```ts
import type { Booking, Room, Property, BookingModificationRequest } from '@/types'

type Props = {
  booking: Booking & { room: Room & { property: Property } }
  modificationRequests?: BookingModificationRequest[]
}
```

Update the function signature:

```ts
export default function BookingDetailPanel({ booking, modificationRequests = [] }: Props) {
```

Add a new section at the bottom of the main `div`, after the cancel section and before the closing `</>`. Insert before `{showCancelModal && ...}`:

```tsx
        {modificationRequests.length > 0 && (
          <div className="rounded-xl bg-surface-container p-4 space-y-4">
            <h3 className="text-sm font-semibold text-on-surface">Modification Requests</h3>
            {modificationRequests.map((req) => (
              <ModificationRequestRow key={req.id} req={req} bookingId={booking.id} />
            ))}
          </div>
        )}
```

Add the `ModificationRequestRow` component at the bottom of the file (before `Section` and `Field`):

```tsx
function ModificationRequestRow({
  req,
  bookingId,
}: {
  req: BookingModificationRequest
  bookingId: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const router = useRouter()

  async function handleAction(action: 'approve' | 'reject') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/bookings/${bookingId}/modification-requests/${req.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, admin_note: note || undefined }),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Action failed')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const statusColor =
    req.status === 'pending'
      ? 'text-secondary'
      : req.status === 'approved'
        ? 'text-primary'
        : 'text-error'

  return (
    <div className="border border-outline-variant rounded-xl p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className={`font-semibold capitalize ${statusColor}`}>{req.status}</span>
        <span className="text-xs text-on-surface-variant">
          {formatDateTime(req.created_at)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-on-surface-variant">
        <div>
          <span className="text-xs">Check-in</span>
          <p className="text-on-surface">{formatDate(req.requested_check_in)}</p>
        </div>
        <div>
          <span className="text-xs">Check-out</span>
          <p className="text-on-surface">{formatDate(req.requested_check_out)}</p>
        </div>
        <div>
          <span className="text-xs">Guests</span>
          <p className="text-on-surface">{req.requested_guest_count}</p>
        </div>
        <div>
          <span className="text-xs">Price delta</span>
          <p className={req.price_delta >= 0 ? 'text-secondary' : 'text-primary'}>
            {req.price_delta >= 0 ? '+' : ''}
            {formatCurrency(req.price_delta)}
          </p>
        </div>
      </div>
      {req.admin_note && (
        <p className="text-on-surface-variant italic text-xs">Note: {req.admin_note}</p>
      )}
      {req.status === 'pending' && (
        <div className="space-y-2 pt-1">
          <input
            type="text"
            placeholder="Admin note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-surface-highest/40 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
          />
          {error && <p className="text-error text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => handleAction('approve')}
              disabled={loading}
              className="rounded-lg bg-secondary/20 px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-secondary/30 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => handleAction('reject')}
              disabled={loading}
              className="rounded-lg bg-error/20 px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/30 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Confirm TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/admin/\(protected\)/bookings/page.tsx components/admin/BookingDetailPanel.tsx
git commit -m "feat: show modification requests in admin booking detail panel with approve/reject actions"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `cancellation_window_hours` on rooms | Tasks 1, 2, 5 |
| `booking_modification_requests` table | Task 1 |
| `BookingModificationRequest` type | Task 2 |
| `calculateRefund` `windowHours` param | Task 3 |
| `isWithinCancellationWindow` helper | Task 3 |
| `isRoomAvailableExcluding` | Task 4 |
| Admin rooms API + RoomForm field | Task 5 |
| Guest cancel API | Task 6 |
| Guest modify API | Task 7 |
| Admin modification-requests PATCH | Task 8 |
| `BookingManageView` client component | Task 9 |
| `/booking/manage` page (lookup + management) | Task 10 |
| "Manage your booking" link on confirmation | Task 11 |
| Admin `BookingDetailPanel` modifications section | Task 12 |

All spec requirements are covered. No TBDs or placeholders remain.
