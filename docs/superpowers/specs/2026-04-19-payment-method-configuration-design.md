# Payment Method Configuration by Booking Type

**Date:** 2026-04-19
**Status:** Approved

## Overview

Admins can configure which Stripe payment methods are available and what fee applies per method, independently for short-term and long-term bookings. Long-term bookings default to ACH-only; short-term allows all methods. Fees are per-method and replace (not add to) the base processing fee. Guests see method fees before they reach the payment step, and the PaymentIntent amount is finalized when the guest confirms their chosen method.

---

## Data Model

### New table: `payment_method_configs`

```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
booking_type text NOT NULL          -- 'short_term' | 'long_term'
method_key   text NOT NULL          -- Stripe method identifier
label        text NOT NULL          -- Display name shown to guests
is_enabled   boolean NOT NULL DEFAULT true
fee_percent  numeric NOT NULL DEFAULT 0
fee_flat     numeric NOT NULL DEFAULT 0
sort_order   integer NOT NULL DEFAULT 0
created_at   timestamptz NOT NULL DEFAULT now()
updated_at   timestamptz NOT NULL DEFAULT now()
UNIQUE (booking_type, method_key)
```

### Seeded rows (migration)

All methods exist for both booking types. Long-term starts with only `us_bank_account` enabled so the admin can add others later without a migration.

| booking_type | method_key | label | is_enabled | fee_percent | fee_flat |
|---|---|---|---|---|---|
| short_term | card | Credit / Debit Card | true | 2.9 | 0.30 |
| short_term | us_bank_account | ACH Bank Transfer | true | 0 | 0 |
| short_term | cashapp | Cash App Pay | true | 2.9 | 0.30 |
| long_term | card | Credit / Debit Card | false | 2.9 | 0.30 |
| long_term | us_bank_account | ACH Bank Transfer | true | 0 | 0 |
| long_term | cashapp | Cash App Pay | false | 2.9 | 0.30 |

### Existing `site_settings` columns

`stripe_fee_percent` and `stripe_fee_flat` are retained as-is. They are no longer used for live bookings (each method has its own fee), but remain in the schema as a reference baseline and for any edge-case fallback.

### `PaymentMethodConfig` TypeScript type (new, in `types/index.ts`)

```ts
export interface PaymentMethodConfig {
  id: string
  booking_type: BookingType
  method_key: string
  label: string
  is_enabled: boolean
  fee_percent: number
  fee_flat: number
  sort_order: number
}
```

---

## API Changes

### `POST /api/bookings` (modified)

1. Query `payment_method_configs WHERE booking_type = $1 AND is_enabled = true ORDER BY sort_order` for the booking's type.
2. Create the PaymentIntent with:
   - `amount = total_amount` (base only, no processing fee)
   - `payment_method_types` = array of enabled `method_key` values
3. Store `processing_fee = 0` in the `bookings` row initially.
4. Return existing fields plus `available_payment_methods: PaymentMethodConfig[]`.

### New: `PATCH /api/bookings/[id]/payment-method`

Called by the frontend just before `stripe.confirmPayment()`.

**Request body:** `{ method_key: string }`

**Server logic:**
1. Auth: verify the booking exists and is in `pending` status.
2. Look up `payment_method_configs` for `(booking.booking_type, method_key)` — must be enabled.
3. Calculate: `processing_fee = round(booking.total_amount × fee_percent/100 + fee_flat, 2)`
4. New grand total: `grand_total = booking.total_amount + processing_fee`
5. Update PaymentIntent: `stripe.paymentIntents.update(id, { amount: grand_total * 100 })`
6. Update `bookings` row: `processing_fee`, `total_amount = grand_total`
7. Return `{ processing_fee, grand_total }`

### New: `GET /api/admin/payment-method-configs`

Admin-only. Returns all rows from `payment_method_configs` grouped by `booking_type`.

### New: `PATCH /api/admin/payment-method-configs/[id]`

Admin-only. Accepts `{ is_enabled?, fee_percent?, fee_flat? }`. Updates the single row and sets `updated_at`.

---

## Frontend — Checkout

### `CheckoutForm.tsx` (modified)

- Store `availablePaymentMethods: PaymentMethodConfig[]` from the booking creation response.
- Store `selectedMethod: string | null` in state, updated via `PaymentElement onChange`.
- Store `processingFee: number` and `grandTotal: number` in state (initially 0 / base total).

**Guest info step addition:**
- Render `<PaymentMethodFeeInfo methods={availablePaymentMethods} />` below the consent checkboxes, above the Continue button.

**"Complete Booking" click sequence:**
1. Guard: if `selectedMethod` is null, show an error ("Please select a payment method") and abort — this should be unreachable in practice since `PaymentElement` fires `onChange` on mount with the default method.
2. Call `PATCH /api/bookings/{bookingId}/payment-method` with `{ method_key: selectedMethod }`.
3. On success, call `onProcessingFeeSet(processing_fee)` to update the summary, and store `grandTotal` in local state.
4. Call `stripe.confirmPayment({ elements, redirect: 'if_required' })`.

### New component: `components/public/PaymentMethodFeeInfo.tsx`

Read-only informational block. Props: `methods: PaymentMethodConfig[]`.

Renders a compact list of method name + formatted fee string:
- 0% + $0 flat → "No processing fee"
- percent only → "X%"
- flat only → "$X.XX flat"
- both → "X% + $X.XX"

Shown in the guest info step so guests know the fees before they reach the payment screen.

### `CheckoutSummary.tsx` (modified)

- No prop interface change needed. `CheckoutForm` already calls `onProcessingFeeSet` on booking creation (returns 0 initially). It calls it a second time after the PATCH succeeds with the confirmed method fee. `CheckoutSummary` re-renders with the updated fee automatically.
- Adds a small note: "Processing fee depends on payment method selected."

---

## Frontend — Admin Settings

### `SettingsForm.tsx` (modified)

New **"Payment Methods"** section added below existing fee settings. Two subsections: **Short-term Bookings** and **Long-term Bookings** (stacked on mobile, side-by-side on desktop).

Each subsection renders a list of method rows. Per row:
- Method label (read-only)
- `is_enabled` toggle switch
- `fee_percent` numeric input ("Fee %")
- `fee_flat` numeric input ("Flat fee $")

Changes save per-row via individual `PATCH /api/admin/payment-method-configs/[id]` calls on input blur. No bulk save needed.

A note under each subsection: _"Fee replaces the base processing fee for this payment method."_

---

## Error Handling

- If `PATCH /api/bookings/[id]/payment-method` receives an unrecognised or disabled `method_key`, return `400`.
- If Stripe PaymentIntent update fails, return `500` — frontend shows existing error banner and does not call `confirmPayment`.
- If `available_payment_methods` is empty (all disabled), block booking creation and return a `422` with a clear message. Admin misconfiguration should not silently create a broken checkout.

---

## Out of Scope

- Per-property payment method overrides (system-level only)
- Adding new method types beyond the seeded set (requires code + migration)
- Fee caps (e.g. ACH capped at $5) — fee_percent + fee_flat only
- Refund logic changes — refund behaviour is unchanged
