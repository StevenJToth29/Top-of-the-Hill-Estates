# Guest Booking Management — Design Spec

**Date:** 2026-04-15  
**Status:** Approved

---

## Overview

Guests can view, cancel, and request modifications to their reservation via a self-service management page at `/booking/manage`. There are no guest accounts — identity is established by possessing both a booking reference and the associated email address. Cancellations execute immediately per policy. Modification requests are flagged for admin review; no money moves automatically on modification.

---

## Goals

- Let guests access their booking without an account
- Let guests cancel within policy (refund auto-issued via Stripe)
- Let guests request date and/or guest count changes (admin approves; money handled manually)
- Make the cancellation window configurable per room

---

## Out of Scope

- Guest accounts / authentication
- Automatic payment collection or refunds on modification approval
- Modifying booking type (short-term ↔ long-term)
- Admin UI for modification requests (minimal: extend `BookingDetailPanel`)

---

## Data Model Changes

### Migration: `007_guest_booking_management.sql`

**`rooms` table — new column:**
```sql
ALTER TABLE rooms
  ADD COLUMN cancellation_window_hours INT NOT NULL DEFAULT 72;
```

**New table: `booking_modification_requests`**
```sql
CREATE TABLE booking_modification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  requested_check_in DATE NOT NULL,
  requested_check_out DATE NOT NULL,
  requested_guest_count INT NOT NULL,
  requested_total_nights INT NOT NULL,
  price_delta NUMERIC NOT NULL,         -- positive = guest owes more, negative = refund owed
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_modification_requests_updated_at
  BEFORE UPDATE ON booking_modification_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: service role only (no public access to this table)
ALTER TABLE booking_modification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on modification requests"
  ON booking_modification_requests
  USING (auth.role() = 'service_role');
```

---

## Types (`types/index.ts`)

Add to `Room`:
```ts
cancellation_window_hours: number  // default 72
```

Add new interface:
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

---

## `lib/cancellation.ts` Changes

`calculateRefund` gains an optional `windowHours` parameter (default `72`):

```ts
export function calculateRefund(
  booking: Booking,
  cancelledAt: Date,
  windowHours = 72,
): RefundResult
```

The inner threshold `hoursUntilCheckIn > 72` becomes `hoursUntilCheckIn > windowHours`. The 7-day (168-hour) tier for the 50% refund remains hardcoded. Policy description strings update to reflect the actual window value.

**Cutoff check helper** (used by both cancel and modify routes):
```ts
export function isWithinCancellationWindow(
  booking: Booking,
  now: Date,
  windowHours = 72,
): boolean
```
Returns `true` if check-in is within `windowHours` hours from `now`.

---

## Page: `/booking/manage`

**File:** `app/(public)/booking/manage/page.tsx` — async server component.

### Lookup State (no valid params)

Renders a centered card with:
- Heading: "Manage Your Booking"
- Field: "Booking Reference" — the 8-character code shown on the confirmation page (e.g. `A1B2C3D4`)
- Field: "Email Address"
- Submit button: "Find My Booking"

On submit (GET form), the page redirects to itself with `?booking_id=<input>&guest_email=<input>`. Server resolves the 8-char prefix to a full UUID using:
```sql
SELECT * FROM bookings
WHERE id::text ILIKE '<lower_prefix>%'
  AND guest_email ILIKE '<email>'
LIMIT 1
```
If no match: render an inline error ("We couldn't find a booking with those details. Please check your confirmation email.") and show the form again.

### Management State (valid params, booking found)

Server fetches:
- Full booking + room + property (service role client)
- `booking_modification_requests` where `booking_id = id` and `status = 'pending'` (to detect existing pending request)
- Room's `cancellation_window_hours`

Renders:

**Booking Summary card** — room name, property, check-in/out, guest count, total paid. Links back to `/booking/confirmation?booking_id=...&guest_email=...`.

**Status banner** — if `status = 'cancelled'`: "This reservation was cancelled on \<date\>. Refund: \$X." If `status = 'completed'`: "This stay has been completed." If either, no action sections are rendered.

**Within-window banner** — if `isWithinCancellationWindow` is true: "Modifications and cancellations are no longer available within \<N\> hours of check-in." No action forms shown.

**Cancel section** (confirmed bookings, outside window):
- Cancellation policy text (same as confirmation page, with dynamic window hours)
- Expected refund amount calculated and shown
- "Cancel Reservation" button — client component, posts to guest cancel API, shows inline success/error

**Modify section** (confirmed bookings, outside window, no pending request):
- Current values pre-filled
- Date pickers for check-in / check-out (availability-blocked, same DatePicker component as booking widget, excluding current booking's dates from blocked set)
- Guest count selector (bounded by room's `guest_capacity`)
- Computed new total and price delta shown inline ("Your new total would be \$X — \$Y more than paid" or "eligible for a \$Y partial refund if approved")
- "Request Change" button — posts to guest modify API

**Pending request banner** (if pending request exists):
- "You have a pending modification request submitted on \<date\>. The host will be in touch soon."
- Shows the requested dates and guest count
- If `admin_note` is set: displays it
- If `status = 'rejected'`: shows "Your modification request was not approved." + note, and re-shows the modify form

**"Manage your booking" link on confirmation page:**  
Add to `BookingConfirmation.tsx` below the cancellation policy section:
```tsx
<a href={`/booking/manage?booking_id=${booking.id}&guest_email=${booking.guest_email}`}>
  Manage your booking
</a>
```

---

## API Routes

### `POST /api/bookings/[id]/cancel/guest`

**Auth:** Validates `guest_email` from request body matches `bookings.guest_email` (case-insensitive). No Supabase session required.

**Request body:**
```ts
{ guest_email: string }
```

**Logic:**
1. Fetch booking by `id`; 404 if not found
2. Verify `guest_email` matches; 403 if not
3. If `status !== 'confirmed'`: 400 "Booking cannot be cancelled in its current state"
4. Fetch room `cancellation_window_hours`
5. If `isWithinCancellationWindow(booking, now, windowHours)`: 400 "Cancellations are not available within \<N\> hours of check-in"
6. Call `calculateRefund(booking, now, windowHours)`
7. Update booking: `status = 'cancelled'`, `cancellation_reason = 'guest_requested'`, `cancelled_at`, `refund_amount`
8. If `refund_amount > 0` and `stripe_payment_intent_id` set: issue Stripe refund
9. Return `{ success: true, refund_amount }`

### `POST /api/bookings/[id]/modify`

**Auth:** Same `guest_email` body validation.

**Request body:**
```ts
{
  guest_email: string
  check_in: string       // ISO date
  check_out: string      // ISO date
  guest_count: number
}
```

**Logic:**
1. Fetch booking by `id` (with room rates); 404 if not found
2. Verify `guest_email`; 403 if not
3. If `status !== 'confirmed'`: 400
4. Fetch room `cancellation_window_hours`
5. If within window: 400
6. Check for existing `pending` modification request; 409 if found
7. Validate new dates: check_in < check_out, total_nights ≥ room's `minimum_nights_short_term` (or `minimum_nights_long_term` for long-term)
8. Call `isRoomAvailable(room_id, check_in, check_out)` — must exclude the current booking's dates. Implement a new `isRoomAvailableExcluding(roomId, checkIn, checkOut, excludeBookingId)` helper in `lib/availability.ts`
9. Server-compute new total using room's current rates and the booking's existing `booking_type` (short-term: `total_nights × nightly_rate + cleaning_fee + extra_guest_fees + generic_fees`; long-term: `monthly_rate + security_deposit + extra_guest_fees + generic_fees` — same formula as booking creation, preserving the original fee snapshots where possible)
10. Compute `price_delta = new_total - booking.total_amount`
11. Compute `requested_total_nights`
12. Insert `booking_modification_requests` row with `status = 'pending'`
13. Return `{ success: true, price_delta, new_total, request_id }`

### Admin: `PATCH /api/admin/bookings/[id]/modification-requests/[reqId]`

**Auth:** Supabase admin session (existing pattern).

**Request body:**
```ts
{ action: 'approve' | 'reject', admin_note?: string }
```

**On approve:**
- Update `bookings`: `check_in`, `check_out`, `total_nights`, `guest_count` from the request row
- Update request: `status = 'approved'`, `admin_note`

**On reject:**
- Update request: `status = 'rejected'`, `admin_note`

No Stripe actions taken by this route.

---

## Admin UI Changes

**`BookingDetailPanel`** — add a "Modification Requests" section that lists pending/resolved requests for the selected booking with approve/reject buttons. Approve button posts to the admin PATCH route above.

**`RoomForm`** — add a "Cancellation Window" number input (hours, default 72) in the pricing/policy section. Wired to `cancellation_window_hours` on the room record.

---

## `lib/availability.ts` Addition

```ts
/**
 * Same as isRoomAvailable but excludes one booking from the blocked set
 * (used when checking availability for a modification of an existing booking).
 */
export async function isRoomAvailableExcluding(
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId: string,
): Promise<boolean>
```

Queries blocked dates same as `isRoomAvailable` but adds `.neq('id', excludeBookingId)` to the bookings query.

---

## File Summary

| File | Action |
|---|---|
| `supabase/migrations/007_guest_booking_management.sql` | New — add `cancellation_window_hours` to rooms, create `booking_modification_requests` |
| `types/index.ts` | Extend `Room`, add `BookingModificationRequest` |
| `lib/cancellation.ts` | Add `windowHours` param to `calculateRefund`, add `isWithinCancellationWindow` helper |
| `lib/availability.ts` | Add `isRoomAvailableExcluding` |
| `app/(public)/booking/manage/page.tsx` | New — lookup + management page |
| `components/public/BookingManageView.tsx` | New — client component rendered inside the server page; owns cancel/modify form state, posts to API routes, shows inline success/error feedback |
| `app/api/bookings/[id]/cancel/guest/route.ts` | New — guest cancel route |
| `app/api/bookings/[id]/modify/route.ts` | New — guest modify route |
| `app/api/admin/bookings/[id]/modification-requests/[reqId]/route.ts` | New — admin approve/reject route |
| `components/public/BookingConfirmation.tsx` | Add "Manage your booking" link |
| `components/admin/BookingDetailPanel.tsx` | Add modification requests section |
| `components/admin/RoomForm.tsx` | Add `cancellation_window_hours` field |
