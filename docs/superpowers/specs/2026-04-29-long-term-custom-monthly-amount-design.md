# Design: Custom Monthly Amount for Manual Long-Term Bookings

**Date:** 2026-04-29  
**Status:** Approved

## Problem

When an admin creates a manual long-term booking, the monthly rate and total amount are computed server-side from the room's configured `monthly_rate` plus security deposit and extra-guest fees. There is no way to record a negotiated rate that differs from the room's list price.

## Goal

Allow the admin to enter a custom monthly amount when adding a manual long-term booking. That amount becomes the authoritative per-month rate and total amount for the booking, bypassing the standard breakdown.

## Scope

- Manual long-term bookings only (admin-initiated via `/api/admin/bookings/manual`)
- Short-term bookings are unaffected
- No DB schema changes required

## Design

### Form — `components/admin/ManualBookingForm.tsx`

- Add `monthlyAmount` state (number, default `0`)
- When `bookingType === 'long_term'` and `roomId` changes, reset `monthlyAmount` to `selectedRoom?.monthly_rate ?? 0` via `useEffect`
- Render a "Monthly Amount" number input beneath the booking-type toggle, visible only when `bookingType === 'long_term'`; input has a `$` prefix and is pre-filled with the room rate but editable
- Update the price summary for long-term to display the admin-entered `monthlyAmount` instead of the room-derived rate
- Include `admin_monthly_amount: monthlyAmount` in the POST body

### API — `app/api/admin/bookings/manual/route.ts`

- Read optional `admin_monthly_amount` from the parsed request body
- Validate: if `bookingType === 'long_term'` and `admin_monthly_amount` is present, it must be a finite positive number; reject with 400 otherwise
- When valid, use `admin_monthly_amount` as both `monthly_rate` and `total_amount` in the Supabase insert, skipping the standard long-term computation (`room.monthly_rate + security_deposit + extraGuestTotal`)
- If `admin_monthly_amount` is absent or zero for a long-term booking, fall back to the existing computation (no breaking change)

## Data Flow

```
Admin enters custom amount
  → form sends admin_monthly_amount in POST body
  → API validates (positive finite number)
  → API inserts booking with monthly_rate = admin_monthly_amount, total_amount = admin_monthly_amount
  → standard security_deposit / extra_guest_fee lines are set to 0 for this booking
```

## Error Handling

- Non-positive or non-finite `admin_monthly_amount` → 400 Bad Request from API
- Form requires the field to be > 0 before submission when long-term is selected

## Out of Scope

- Short-term custom pricing
- Editing the monthly amount on an existing booking
- Displaying the custom amount differently from the standard rate anywhere else in the UI
