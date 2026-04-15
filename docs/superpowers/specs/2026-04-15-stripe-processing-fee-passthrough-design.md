# Stripe Processing Fee Passthrough — Design Spec

**Date:** 2026-04-15
**Status:** Approved

---

## Overview

Pass Stripe's payment processing fee through to customers. The fee is displayed as a visible, labeled line item in the checkout summary, is configurable by the admin, and is explicitly non-refundable with the customer informed of this at checkout.

---

## 1. Database Schema

Single migration (`007_stripe_processing_fee.sql`) with three changes:

### `site_settings`
```sql
ALTER TABLE site_settings
  ADD COLUMN stripe_fee_percent NUMERIC NOT NULL DEFAULT 2.9,
  ADD COLUMN stripe_fee_flat    NUMERIC NOT NULL DEFAULT 0.30;
```

### `bookings`
```sql
ALTER TABLE bookings
  ADD COLUMN processing_fee NUMERIC NOT NULL DEFAULT 0;
```
Stores the calculated fee at the time of booking (snapshot). Used to exclude the fee from refund calculations.

### `booking_fees`
```sql
ALTER TABLE booking_fees
  ADD COLUMN is_refundable BOOLEAN NOT NULL DEFAULT TRUE;
```
Existing rows default to `true`. The processing fee row is inserted with `is_refundable: false`. This flag enables future extensibility (other fees can also be marked non-refundable).

---

## 2. Server-side Fee Calculation (`/api/bookings` POST)

The processing fee is **always calculated server-side** — never trusted from the client.

### Formula
```
processing_fee = round((total_amount × stripe_fee_percent / 100) + stripe_fee_flat, 2)
grand_total    = total_amount + processing_fee
```

### Steps
1. Fetch `stripe_fee_percent` and `stripe_fee_flat` from `site_settings` alongside room data.
2. Calculate `total_amount` (existing logic: nightly/monthly + cleaning/deposit + extra guest + generic fees).
3. Apply formula to get `processing_fee` and `grand_total`.
4. Create `PaymentIntent` for `grand_total` (in cents).
5. Insert `bookings` row with:
   - `total_amount = grand_total`
   - `processing_fee = processing_fee`
6. Insert `booking_fees` row:
   ```json
   { "label": "Processing Fee", "amount": processing_fee, "is_refundable": false }
   ```
7. Return `processing_fee` and `total_amount` in the API response alongside `clientSecret`.

---

## 3. Admin Settings UI

### `site_settings` API (`/api/admin/settings`)
Extend read/write payload to include `stripe_fee_percent` and `stripe_fee_flat`.

### `SettingsForm` component
Add a new **"Payment Processing"** section with two numeric inputs:

| Field | Label | Default |
|-------|-------|---------|
| `stripe_fee_percent` | Processing fee (%) | 2.9 |
| `stripe_fee_flat` | Processing fee (flat, $) | 0.30 |

Helper text under each field: *"Stripe's standard rate is 2.9% + $0.30 per transaction."*

---

## 4. Checkout Summary Display

### `CheckoutSummary` component
Add a "Processing fee" line item between other fees and the grand total:

```
Nightly rate (3 × $150.00)    $450.00
Cleaning fee                    $75.00
Processing fee                  $15.53   ← new
──────────────────────────────────────
Total                          $540.53
```

The `processing_fee` value is sourced from the `/api/bookings` POST response — never computed on the client.

### Non-refundable notice
Display in two locations:
1. **Below the total** in `CheckoutSummary`: *"Processing fees are non-refundable."*
2. **Near the Pay button** in `CheckoutForm` Step 2 (payment confirmation step): *"Processing fees are non-refundable."*

---

## 5. Refund Logic (`/api/bookings/[id]/cancel`)

The cancel route excludes the processing fee from any refund issued:

```
stripe_refund_amount = calculated_refund - booking.processing_fee
```

- If `stripe_refund_amount <= 0`, no Stripe refund is issued.
- The `booking.processing_fee` column is the authoritative source for exclusion — no need to query `booking_fees`.
- The webhook handler (`payment_intent.succeeded`) is unchanged: `amount_paid` still records the full charged amount including the processing fee, which is correct for accounting.

---

## Out of Scope

- Partial refund scenarios involving the processing fee (future consideration).
- Per-payment-method fee rates (e.g. different rates for ACH vs. card) — use a single configurable rate.
- Retroactive recalculation of processing fees on existing bookings.
