# Design: Edit Monthly Amount on Existing Long-Term Bookings

**Date:** 2026-04-29  
**Status:** Approved

## Problem

The Edit Booking form recalculates the long-term total using the room's current `monthly_rate + security_deposit + extra_guest_fee`. There is no way to set a custom monthly amount on an existing long-term booking, so a negotiated rate applied at creation cannot be adjusted later.

## Goal

Allow the admin to edit the monthly amount on an existing long-term booking. The custom amount becomes both `monthly_rate` and `total_amount` on the booking, bypassing the standard breakdown. The existing Stripe delta logic (payment requests / refunds) continues to apply based on the difference between the new and original totals.

## Scope

- Long-term bookings only
- Admin edit flow only (`EditBookingForm` + `/api/admin/bookings/[id]/edit`)
- No DB schema changes required

## Design

### Form — `components/admin/EditBookingForm.tsx`

- Add `monthlyAmount` state initialized from `booking.monthly_rate`
- Render an editable "Monthly Amount" number input (long-term only), matching the creation form's style (`$` prefix, `bg-white` field consistent with surrounding inputs)
- Update the `newTotal` calculation for long-term: use `monthlyAmount` directly instead of `computeLongTermTotal(room.monthly_rate, ...)`, keeping `additionalFees` added on top
- Add `admin_monthly_amount: monthlyAmount` to the PATCH body when `isLongTerm`
- Add client-side validation: `monthlyAmount` must be > 0, show inline error if not

### API — `app/api/admin/bookings/[id]/edit/route.ts`

- Read optional `admin_monthly_amount` from request body
- When `booking_type === 'long_term'` and `admin_monthly_amount` is present, validate it is a positive finite number (return 400 otherwise)
- Use it as `newTotal` (replacing the standard formula), keeping `additionalFees` added on top
- Store it as `monthly_rate` in the DB update alongside `total_amount`
- The existing `priceDelta = newTotal - b.total_amount` calculation continues unchanged, so Stripe payment/refund logic fires correctly

## Data Flow

```
Admin edits monthly amount in form
  → form sends admin_monthly_amount in PATCH body
  → API validates (positive finite number)
  → newTotal = admin_monthly_amount + additionalFees
  → DB update: monthly_rate = admin_monthly_amount, total_amount = newTotal
  → priceDelta triggers Stripe payment request or refund as normal
```

## Error Handling

- Non-positive or non-finite `admin_monthly_amount` → 400 Bad Request from API
- Form blocks submission if `monthlyAmount <= 0` with inline error message

## Out of Scope

- Short-term custom pricing
- Editing deposit or fee snapshots individually
