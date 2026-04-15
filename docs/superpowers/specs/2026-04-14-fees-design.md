# Fees Design — Cleaning Fee, Security Deposit, and Generic Room Fees

**Date:** 2026-04-14
**Status:** Approved

---

## Overview

Add two specific per-room fees — a **cleaning fee** for short-term stays and a **security deposit** for long-term stays — both charged immediately at booking. Also introduce a **generic room fees system** (`room_fees` table) so admins can add free-form fees (label + amount + booking type) per room beyond the two specific ones.

---

## Data Model

### Migration: `004_add_fees.sql`

```sql
-- Option A: Specific fees on rooms
ALTER TABLE rooms
  ADD COLUMN cleaning_fee NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN security_deposit NUMERIC NOT NULL DEFAULT 0;

-- Snapshot specific fees at booking time
ALTER TABLE bookings
  ADD COLUMN cleaning_fee NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN security_deposit NUMERIC NOT NULL DEFAULT 0;

-- Option B: Generic per-room fees
CREATE TABLE room_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  booking_type TEXT NOT NULL CHECK (booking_type IN ('short_term', 'long_term', 'both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable snapshot of generic fees applied to a booking
CREATE TABLE booking_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### TypeScript types (`types/index.ts`)

**New interfaces:**
```typescript
export interface RoomFee {
  id: string
  room_id: string
  label: string
  amount: number
  booking_type: 'short_term' | 'long_term' | 'both'
  created_at: string
}

export interface BookingFee {
  id: string
  booking_id: string
  label: string
  amount: number
  created_at: string
}
```

**Updated `Room`:**
- Add `cleaning_fee?: number`
- Add `security_deposit?: number`
- Add `fees?: RoomFee[]`

**Updated `Booking`:**
- Add `cleaning_fee: number`
- Add `security_deposit: number`
- Add `fees?: BookingFee[]`

**Updated `BookingParams`:**
- Add `cleaning_fee: number`
- Add `security_deposit: number`

---

## Pricing Logic

The `/api/bookings` route is the **authoritative pricing calculator**. It fetches `room_fees` and the room's `cleaning_fee`/`security_deposit` fresh from the database — client-provided values for fees are ignored.

### Short-term
```
total_amount = (total_nights × nightly_rate)
             + cleaning_fee
             + sum(room_fees where booking_type IN ('short_term', 'both'))

amount_due_at_checkin = 0
amount_to_pay = total_amount
```

### Long-term
```
total_amount = monthly_rate
             + security_deposit
             + sum(room_fees where booking_type IN ('long_term', 'both'))

amount_due_at_checkin = 0   ← replaces the prior "second month at check-in" model
amount_to_pay = total_amount
```

After calculating the total, the booking route:
1. Inserts the `bookings` row with snapshotted `cleaning_fee` and `security_deposit`
2. Inserts a `booking_fees` row for each applied `room_fee` (label + amount snapshot)

---

## Admin Room Form (`components/admin/RoomForm.tsx`)

### Pricing & Minimums section changes

**Nightly rate block** gains:
- `Cleaning Fee` — number input with `$` prefix, shown/grayed alongside the nightly rate toggle

**Monthly rate block** gains:
- `Security Deposit` — number input with `$` prefix, shown/grayed alongside the monthly rate toggle

### New "Additional Fees" section

Appears below the Pricing section. Contains a list of fee rows and an "Add Fee" button.

Each fee row:
| Field | Type | Notes |
|---|---|---|
| Label | Text input | e.g. "Pet fee", "Parking" |
| Amount | Number input with `$` prefix | |
| Applies to | Select | Short-term / Long-term / Both |
| Remove | Button | Removes row from list |

**Save behavior:** The full fees array is included in the room's `POST`/`PATCH` JSON payload. The API deletes all existing `room_fees` for the room and reinserts the new array — atomic, no partial state.

---

## API Changes

### `app/api/admin/rooms/route.ts`

**POST and PATCH:**
- Accept `cleaning_fee` and `security_deposit` in request body (numbers, default 0)
- Accept `fees: { label, amount, booking_type }[]` in request body
- After upserting the room, delete all `room_fees` for that `room_id`, then bulk-insert the new fees array

### `app/api/bookings/route.ts`

1. Fetch the room row including `cleaning_fee` and `security_deposit`
2. Fetch all `room_fees` for the room where `booking_type` matches the booking's type (or is `'both'`)
3. Calculate `total_amount` per the pricing logic above
4. Insert `bookings` row with snapshotted fee values
5. Bulk-insert `booking_fees` rows from the fetched `room_fees`

---

## Public Booking Flow

### Room detail page (`app/(public)/rooms/[slug]/page.tsx`)
Fetches `room_fees` alongside the room. Passes them to `BookingWidget`.

### BookingWidget (`components/public/BookingWidget.tsx`)
Displays fee line items below the subtotal in the live pricing preview:

**Short-term preview:**
```
X nights × $Y/night    $Z
Cleaning fee           $X
Pet fee (if any)       $X
─────────────────────────
Total                  $Z
```

**Long-term preview:**
```
First month            $Y
Security deposit       $X
Pet fee (if any)       $X
─────────────────────────
Total due today        $Z
```

Updates `BookingParams` passed to the checkout URL to include `cleaning_fee` and `security_deposit` (for display in CheckoutSummary before booking is created).

### Checkout page (`app/(public)/checkout/page.tsx`)
Re-fetches `room_fees` server-side using `room_id` from URL params. Passes fees to `CheckoutSummary`.

### CheckoutSummary (`components/public/CheckoutSummary.tsx`)
Shows each fee as a distinct labeled line item. Total row reflects all fees.

### BookingConfirmation (`components/public/BookingConfirmation.tsx`)
Fetches `booking_fees` where `booking_id = booking.id` and renders them as labeled line items in the payment summary alongside the snapshotted `cleaning_fee` and `security_deposit` from the `bookings` row.

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/004_add_fees.sql` | New migration |
| `types/index.ts` | New `RoomFee`, `BookingFee` interfaces; update `Room`, `Booking`, `BookingParams` |
| `app/api/admin/rooms/route.ts` | Accept + persist `cleaning_fee`, `security_deposit`, `fees[]` |
| `app/api/bookings/route.ts` | Updated pricing logic; snapshot `booking_fees` |
| `components/admin/RoomForm.tsx` | Cleaning fee + security deposit inputs; Additional Fees section |
| `app/(public)/rooms/[slug]/page.tsx` | Fetch `room_fees` |
| `components/public/BookingWidget.tsx` | Fee line items in pricing preview |
| `app/(public)/checkout/page.tsx` | Fetch `room_fees` server-side |
| `components/public/CheckoutSummary.tsx` | Fee line items in summary |
| `components/public/BookingConfirmation.tsx` | Show `booking_fees` in payment summary |

---

## Out of Scope

- Fee refund tracking (security deposit return workflow)
- Tax calculation
- Per-guest or percentage-based fees
