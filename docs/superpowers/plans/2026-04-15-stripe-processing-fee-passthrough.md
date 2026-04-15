# Stripe Processing Fee Passthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Charge customers the Stripe processing fee, display it as a visible line item, make it configurable in the admin dashboard, and explicitly exclude it from any refund.

**Architecture:** A database migration adds `stripe_fee_percent`/`stripe_fee_flat` to `site_settings`, `processing_fee` to `bookings`, and `is_refundable` to `booking_fees`. The fee is calculated server-side in `POST /api/bookings`, stored in both `bookings.processing_fee` and a `booking_fees` row (`is_refundable: false`), and displayed in `CheckoutSummary`. The cancel route subtracts `processing_fee` from any Stripe refund.

**Tech Stack:** Next.js App Router, Supabase (Postgres), Stripe PaymentIntents, TypeScript, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/007_stripe_processing_fee.sql` | **Create** — schema migration |
| `types/index.ts` | **Modify** — add `processing_fee` to `Booking`, `stripe_fee_percent`/`stripe_fee_flat` to `SiteSettings`, `is_refundable` to `BookingFee` |
| `app/api/bookings/route.ts` | **Modify** — fetch fee config, calculate `processing_fee`, update PaymentIntent amount, insert `booking_fees` row |
| `app/api/admin/settings/route.ts` | **Modify** — read/write `stripe_fee_percent` and `stripe_fee_flat` |
| `components/admin/SettingsForm.tsx` | **Modify** — add "Payment Processing" section with two inputs |
| `components/public/CheckoutSummary.tsx` | **Modify** — add processing fee line item and non-refundable notice |
| `components/public/CheckoutForm.tsx` | **Modify** — add non-refundable notice near Pay button; store `processing_fee` from API response |
| `lib/cancellation.ts` | **Modify** — subtract `booking.processing_fee` from refund amounts |
| `app/api/bookings/[id]/cancel/route.ts` | **Modify** — pass `processing_fee` through to `calculateRefund` (or subtract after) |
| `__tests__/lib/cancellation.test.ts` | **Create** — unit tests for refund exclusion logic |
| `__tests__/api/bookings.test.ts` | **Create** — unit tests for fee calculation in POST handler |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/007_stripe_processing_fee.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/007_stripe_processing_fee.sql

-- 1. Add Stripe fee config columns to site_settings
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS stripe_fee_percent NUMERIC NOT NULL DEFAULT 2.9,
  ADD COLUMN IF NOT EXISTS stripe_fee_flat    NUMERIC NOT NULL DEFAULT 0.30;

-- 2. Add processing_fee snapshot column to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS processing_fee NUMERIC NOT NULL DEFAULT 0;

-- 3. Add is_refundable flag to booking_fees (existing rows stay refundable)
ALTER TABLE booking_fees
  ADD COLUMN IF NOT EXISTS is_refundable BOOLEAN NOT NULL DEFAULT TRUE;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool with:
- `name`: `stripe_processing_fee`
- `query`: the SQL above

- [ ] **Step 3: Verify the migration applied**

Use `mcp__supabase__list_migrations` and confirm `stripe_processing_fee` appears in the list.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/007_stripe_processing_fee.sql
git commit -m "feat: add stripe processing fee columns to DB schema"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add `processing_fee` to the `Booking` interface**

In `types/index.ts`, find the `Booking` interface and add after `extra_guest_fee`:

```typescript
  processing_fee: number
```

Full updated interface excerpt (find this block and add the new field):

```typescript
export interface Booking {
  id: string
  room_id: string
  booking_type: BookingType
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_phone: string
  check_in: string
  check_out: string
  total_nights: number
  nightly_rate: number
  monthly_rate: number
  cleaning_fee: number
  security_deposit: number
  extra_guest_fee: number
  processing_fee: number   // ← add this line
  guest_count: number
  fees?: BookingFee[]
  // ... rest unchanged
```

- [ ] **Step 2: Add `is_refundable` to the `BookingFee` interface**

Find `BookingFee` and add the field:

```typescript
export interface BookingFee {
  id: string
  booking_id: string
  label: string
  amount: number
  is_refundable: boolean   // ← add this line
  created_at: string
}
```

- [ ] **Step 3: Add `stripe_fee_percent` and `stripe_fee_flat` to the `SiteSettings` interface**

Find `SiteSettings` and add after `checkout_time`:

```typescript
export interface SiteSettings {
  id: string
  about_text: string
  contact_phone: string
  contact_email: string
  contact_address: string
  business_name: string
  logo_url?: string
  logo_size?: number
  business_hours?: string
  global_house_rules?: string
  checkin_time?: string
  checkout_time?: string
  stripe_fee_percent?: number   // ← add
  stripe_fee_flat?: number      // ← add
  updated_at: string
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to the new fields.

- [ ] **Step 5: Commit**

```bash
git add types/index.ts
git commit -m "feat: add processing_fee, stripe fee config, and is_refundable types"
```

---

## Task 3: Update the Bookings API (Server-side Fee Calculation)

**Files:**
- Modify: `app/api/bookings/route.ts`

- [ ] **Step 1: Fetch `stripe_fee_percent` and `stripe_fee_flat` from `site_settings`**

After the room query (around line 56), add a `site_settings` query. Replace this block:

```typescript
    if (roomError || !room) {
      console.error('Room lookup failed:', roomError)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
```

With:

```typescript
    if (roomError || !room) {
      console.error('Room lookup failed:', roomError)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const { data: siteSettings } = await supabase
      .from('site_settings')
      .select('stripe_fee_percent, stripe_fee_flat')
      .limit(1)
      .single()

    const stripeFeePercent = Number(siteSettings?.stripe_fee_percent ?? 2.9)
    const stripeFeeFlat = Number(siteSettings?.stripe_fee_flat ?? 0.30)
```

- [ ] **Step 2: Calculate `processing_fee` and `grand_total` after `total_amount` is set**

Find this block (around line 106):

```typescript
    const amount_to_pay = total_amount
    const amount_due_at_checkin = 0
```

Replace with:

```typescript
    const processing_fee = Math.round(
      (total_amount * (stripeFeePercent / 100) + stripeFeeFlat) * 100
    ) / 100
    const grand_total = total_amount + processing_fee

    const amount_to_pay = grand_total
    const amount_due_at_checkin = 0
```

- [ ] **Step 3: Create the PaymentIntent for `grand_total`**

The existing `stripe.paymentIntents.create` call uses `amount_to_pay` which is now `grand_total` — no change needed there, it's already correct.

- [ ] **Step 4: Insert `processing_fee` into the `bookings` row**

Find the `.insert({...})` call and add `processing_fee` and update `total_amount`:

```typescript
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        room_id,
        booking_type,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        check_in,
        check_out,
        total_nights: safeTotalNights,
        nightly_rate,
        monthly_rate,
        cleaning_fee: snapshotCleaningFee,
        security_deposit: snapshotSecurityDeposit,
        extra_guest_fee: snapshotExtraGuestFee,
        guest_count: safeGuestCount,
        total_amount: grand_total,       // ← was total_amount
        processing_fee,                  // ← new
        amount_paid: 0,
        amount_due_at_checkin,
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending',
        sms_consent,
        marketing_consent,
      })
      .select()
      .single()
```

- [ ] **Step 5: Insert the processing fee into `booking_fees` with `is_refundable: false`**

Find the existing `booking_fees` insert block (around line 150) and add the processing fee insert after it:

```typescript
    // Snapshot processing fee as a non-refundable booking fee
    const { error: processingFeeInsertError } = await supabase
      .from('booking_fees')
      .insert({
        booking_id: booking.id,
        label: 'Processing Fee',
        amount: processing_fee,
        is_refundable: false,
      })

    if (processingFeeInsertError) {
      console.error('Failed to snapshot processing fee:', processingFeeInsertError)
      return NextResponse.json({ error: 'Failed to record processing fee' }, { status: 500 })
    }
```

- [ ] **Step 6: Return `processing_fee` in the API response**

Find the return statement:

```typescript
    return NextResponse.json({
      bookingId: booking.id,
      clientSecret: paymentIntent.client_secret,
      total_amount,
      amount_due_at_checkin,
    })
```

Replace with:

```typescript
    return NextResponse.json({
      bookingId: booking.id,
      clientSecret: paymentIntent.client_secret,
      total_amount: grand_total,
      processing_fee,
      amount_due_at_checkin,
    })
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/api/bookings/route.ts
git commit -m "feat: calculate and store Stripe processing fee in bookings API"
```

---

## Task 4: Update Admin Settings API

**Files:**
- Modify: `app/api/admin/settings/route.ts`

- [ ] **Step 1: Add the two new fields to the `fields` object**

Find the `fields` object construction and add the new entries after the `checkout_time` conditional:

```typescript
  if (body.checkin_time !== undefined) fields.checkin_time = body.checkin_time
  if (body.checkout_time !== undefined) fields.checkout_time = body.checkout_time
  if (body.stripe_fee_percent !== undefined) fields.stripe_fee_percent = body.stripe_fee_percent
  if (body.stripe_fee_flat !== undefined) fields.stripe_fee_flat = body.stripe_fee_flat
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/settings/route.ts
git commit -m "feat: add stripe fee config fields to settings API"
```

---

## Task 5: Update Admin Settings Form UI

**Files:**
- Modify: `components/admin/SettingsForm.tsx`

- [ ] **Step 1: Add `stripe_fee_percent` and `stripe_fee_flat` to the form state**

Find the `useState` call for `form` (around line 62) and add the two new fields:

```typescript
  const [form, setForm] = useState({
    id: settings.id,
    business_name: settings.business_name ?? 'Top of the Hill Rooms',
    about_text: settings.about_text ?? '',
    contact_phone: settings.contact_phone ?? '',
    contact_email: settings.contact_email ?? '',
    contact_address: settings.contact_address ?? '',
    logo_url: settings.logo_url ?? '',
    logo_size: settings.logo_size ?? 52,
    global_house_rules: settings.global_house_rules ?? '',
    checkin_time: settings.checkin_time ?? '15:00',
    checkout_time: settings.checkout_time ?? '10:00',
    stripe_fee_percent: settings.stripe_fee_percent ?? 2.9,   // ← add
    stripe_fee_flat: settings.stripe_fee_flat ?? 0.30,        // ← add
  })
```

- [ ] **Step 2: Add the "Payment Processing" section to the form JSX**

Find the closing `</section>` of the "Short-term Booking Times" section (just before the `<div className="flex items-center gap-4">` save button row) and insert the new section + divider before the save button row:

```tsx
      <div className="h-px bg-outline-variant" />

      {/* Payment Processing */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold text-on-surface">Payment Processing</h2>
          <p className="text-xs text-on-surface-variant/60 mt-0.5">
            Stripe's standard rate is 2.9% + $0.30 per transaction.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label htmlFor="stripe_fee_percent" className={labelClass}>
              Processing fee (%)
            </label>
            <input
              id="stripe_fee_percent"
              name="stripe_fee_percent"
              type="number"
              step="0.01"
              min="0"
              value={form.stripe_fee_percent}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, stripe_fee_percent: Number(e.target.value) }))
              }
              className={inputClass}
            />
            <p className="text-xs text-on-surface-variant/50">e.g. 2.9 for 2.9%</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="stripe_fee_flat" className={labelClass}>
              Processing fee (flat, $)
            </label>
            <input
              id="stripe_fee_flat"
              name="stripe_fee_flat"
              type="number"
              step="0.01"
              min="0"
              value={form.stripe_fee_flat}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, stripe_fee_flat: Number(e.target.value) }))
              }
              className={inputClass}
            />
            <p className="text-xs text-on-surface-variant/50">e.g. 0.30 for $0.30</p>
          </div>
        </div>
      </section>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/SettingsForm.tsx
git commit -m "feat: add payment processing fee fields to admin settings form"
```

---

## Task 6: Update Checkout Summary UI

**Files:**
- Modify: `components/public/CheckoutSummary.tsx`

- [ ] **Step 1: Add `processingFee` prop to `CheckoutSummaryProps`**

The `CheckoutSummary` component currently receives `BookingParams`. The `processing_fee` comes from the API response after booking creation — but at the time `CheckoutSummary` is first rendered (before the API call), it won't be available.

**Design decision:** `CheckoutSummary` is rendered throughout the checkout flow, including before the API call. Add `processingFee` as an optional prop (defaults to `0`) so the component can show it once the booking is created.

Find the `CheckoutSummaryProps` interface and add the prop:

```typescript
interface CheckoutSummaryProps {
  params: BookingParams
  roomName: string
  propertyName: string
  checkinTime?: string
  checkoutTime?: string
  processingFee?: number   // ← add
}
```

Update the destructuring:

```typescript
export default function CheckoutSummary({ params, roomName, propertyName, checkinTime, checkoutTime, processingFee = 0 }: CheckoutSummaryProps) {
```

- [ ] **Step 2: Add the processing fee line item to the price breakdown**

Find the `applicableFees.map(...)` block (after the short-term/long-term conditional, around line 143). After that block, add the processing fee line item:

```tsx
        {applicableFees.map((f) => (
          <div key={f.id} className="flex justify-between text-sm">
            <span className="text-on-surface-variant">{f.label}</span>
            <span className="text-on-surface">{formatCurrency(f.amount)}</span>
          </div>
        ))}
        {processingFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Processing fee</span>
            <span className="text-on-surface">{formatCurrency(processingFee)}</span>
          </div>
        )}
```

- [ ] **Step 3: Add the non-refundable notice below the total**

Find the total section (the `pt-4 border-t` div) and add the notice after the `amount_due_at_checkin` block:

```tsx
      <div className="pt-4 border-t border-outline-variant">
        <div className="flex justify-between items-baseline">
          <span className="text-on-surface-variant text-sm font-semibold">Due today</span>
          <span className="text-primary font-bold text-3xl font-display">
            {formatCurrency(params.amount_to_pay)}
          </span>
        </div>
        {params.amount_due_at_checkin > 0 && (
          <p className="text-on-surface-variant text-xs mt-1 text-right">
            + {formatCurrency(params.amount_due_at_checkin)} due at check-in
          </p>
        )}
        {processingFee > 0 && (
          <p className="text-on-surface-variant/60 text-xs mt-2 text-right italic">
            Processing fees are non-refundable.
          </p>
        )}
      </div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/public/CheckoutSummary.tsx
git commit -m "feat: show processing fee line item and non-refundable notice in checkout summary"
```

---

## Task 7: Wire Processing Fee Through CheckoutForm and CheckoutPageInner

**Files:**
- Modify: `components/public/CheckoutForm.tsx`
- Modify: `components/public/CheckoutPageInner.tsx`

The `processing_fee` returned by `POST /api/bookings` needs to flow from `CheckoutForm` up to `CheckoutSummary`. The cleanest way: store `processingFee` in `CheckoutForm` state and lift it to the parent via a callback, or pass it to `CheckoutSummary` directly from the layout.

**Approach:** Since `CheckoutForm` and `CheckoutSummary` are siblings rendered in `CheckoutPageInner`, lift `processingFee` state to `CheckoutPageInner`.

- [ ] **Step 1: Add `processingFee` state and callback to `CheckoutPageInner`**

In `components/public/CheckoutPageInner.tsx`, replace the import line and the component body as follows.

Add `useState` to the React import at the top:

```typescript
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CheckoutForm from '@/components/public/CheckoutForm'
import CheckoutSummary from '@/components/public/CheckoutSummary'
import { BookingParams, BookingType, RoomFee } from '@/types'
```

Inside the `CheckoutPageInner` function body, add the state declaration right after the `propertyName` line (around line 67):

```typescript
  const propertyName = getParam('property_name') || 'Top of the Hill Estates'
  const [processingFee, setProcessingFee] = useState(0)  // ← add this line
```

Update the JSX render at the bottom to pass the new props:

```tsx
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-6 lg:p-8">
            <CheckoutForm
              bookingParams={bookingParams}
              onProcessingFeeSet={setProcessingFee}
            />
          </div>

          <div className="lg:col-span-2">
            <CheckoutSummary
              params={bookingParams}
              roomName={roomName}
              propertyName={propertyName}
              checkinTime={checkinTime}
              checkoutTime={checkoutTime}
              processingFee={processingFee}
            />
          </div>
        </div>
```

- [ ] **Step 2: Update `CheckoutForm` to accept and call `onProcessingFeeSet`**

Add the prop to `CheckoutFormProps`:

```typescript
interface CheckoutFormProps {
  bookingParams: BookingParams
  onProcessingFeeSet: (fee: number) => void
}
```

Update destructuring:

```typescript
export default function CheckoutForm({ bookingParams, onProcessingFeeSet }: CheckoutFormProps) {
```

In `handleGuestInfoSubmit`, after receiving a successful response, call the callback:

```typescript
      setClientSecret(data.clientSecret)
      setBookingId(data.bookingId)
      onProcessingFeeSet(data.processing_fee ?? 0)   // ← add this line
      setStep('payment')
```

- [ ] **Step 3: Add non-refundable notice near the Pay button in Step 2 (payment step)**

In `CheckoutForm`, find the payment step JSX (the `step === 'payment'` block). Add the notice just before the `<Elements>` block:

```tsx
          <p className="text-on-surface-variant/60 text-xs italic">
            Processing fees are non-refundable.
          </p>

          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/public/CheckoutForm.tsx components/public/CheckoutPageInner.tsx
git commit -m "feat: lift processing fee state and show non-refundable notice at payment step"
```

---

## Task 8: Update Cancellation Refund Logic

**Files:**
- Modify: `lib/cancellation.ts`
- Modify: `app/api/bookings/[id]/cancel/route.ts`

- [ ] **Step 1: Write a failing test for the refund exclusion**

Create `__tests__/lib/cancellation.test.ts`:

```typescript
import { calculateRefund } from '@/lib/cancellation'
import type { Booking } from '@/types'

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'test-id',
    room_id: 'room-id',
    booking_type: 'short_term',
    guest_first_name: 'Jane',
    guest_last_name: 'Smith',
    guest_email: 'jane@example.com',
    guest_phone: '5555555555',
    check_in: '2030-06-20',
    check_out: '2030-06-23',
    total_nights: 3,
    nightly_rate: 150,
    monthly_rate: 0,
    cleaning_fee: 75,
    security_deposit: 0,
    extra_guest_fee: 0,
    processing_fee: 14.25,
    guest_count: 1,
    total_amount: 539.25,
    amount_paid: 539.25,
    amount_due_at_checkin: 0,
    stripe_payment_intent_id: 'pi_test',
    stripe_session_id: null,
    status: 'confirmed',
    cancellation_reason: null,
    cancelled_at: null,
    refund_amount: null,
    ghl_contact_id: null,
    sms_consent: true,
    marketing_consent: false,
    created_at: '2030-01-01T00:00:00Z',
    updated_at: '2030-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('calculateRefund', () => {
  describe('short_term - full refund window (>7 days out)', () => {
    it('refunds amount_paid minus processing_fee', () => {
      const booking = makeBooking({ amount_paid: 539.25, processing_fee: 14.25 })
      // Cancel 10 days before check-in
      const cancelledAt = new Date('2030-06-10T12:00:00Z')
      const result = calculateRefund(booking, cancelledAt)
      expect(result.refund_amount).toBe(525.00)  // 539.25 - 14.25
      expect(result.refund_percentage).toBe(100)
    })
  })

  describe('short_term - 50% refund window (3–7 days out)', () => {
    it('refunds 50% of (amount_paid - processing_fee)', () => {
      const booking = makeBooking({ amount_paid: 539.25, processing_fee: 14.25 })
      // Cancel 5 days before check-in
      const cancelledAt = new Date('2030-06-15T12:00:00Z')
      const result = calculateRefund(booking, cancelledAt)
      expect(result.refund_amount).toBe(262.50)  // (539.25 - 14.25) * 0.5
      expect(result.refund_percentage).toBe(50)
    })
  })

  describe('short_term - no refund window (<72 hours out)', () => {
    it('returns 0 refund', () => {
      const booking = makeBooking({ amount_paid: 539.25, processing_fee: 14.25 })
      // Cancel 1 day before check-in
      const cancelledAt = new Date('2030-06-19T12:00:00Z')
      const result = calculateRefund(booking, cancelledAt)
      expect(result.refund_amount).toBe(0)
    })
  })

  describe('long_term', () => {
    it('always returns 0 refund regardless of processing_fee', () => {
      const booking = makeBooking({
        booking_type: 'long_term',
        amount_paid: 1500,
        processing_fee: 43.80,
      })
      const cancelledAt = new Date('2030-06-10T12:00:00Z')
      const result = calculateRefund(booking, cancelledAt)
      expect(result.refund_amount).toBe(0)
    })
  })

  describe('processing_fee is 0', () => {
    it('full refund equals amount_paid when no processing fee', () => {
      const booking = makeBooking({ amount_paid: 525.00, processing_fee: 0 })
      const cancelledAt = new Date('2030-06-10T12:00:00Z')
      const result = calculateRefund(booking, cancelledAt)
      expect(result.refund_amount).toBe(525.00)
    })
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx jest __tests__/lib/cancellation.test.ts --no-coverage
```

Expected: FAIL — `calculateRefund` doesn't subtract `processing_fee` yet.

- [ ] **Step 3: Update `lib/cancellation.ts` to subtract `processing_fee`**

Replace the full file content with:

```typescript
import type { Booking, RefundResult } from '@/types'
import { differenceInHours } from 'date-fns/differenceInHours'
import { parseISO } from 'date-fns/parseISO'

/**
 * Calculates the refund amount based on the cancellation policy.
 * The Stripe processing fee is always excluded from any refund.
 *
 * Short-term policy:
 *   - Cancelled > 7 days before check-in → 100% refund (excl. processing fee)
 *   - Cancelled > 72 hours but within 7 days before check-in → 50% refund (excl. processing fee)
 *   - Cancelled within 72 hours of check-in → 0% refund
 *
 * Long-term policy:
 *   - Deposit is non-refundable → 0% refund always
 */
export function calculateRefund(booking: Booking, cancelledAt: Date): RefundResult {
  const checkInDate = parseISO(booking.check_in)
  const hoursUntilCheckIn = differenceInHours(checkInDate, cancelledAt)
  const processingFee = booking.processing_fee ?? 0
  const refundableAmount = booking.amount_paid - processingFee

  if (booking.booking_type === 'long_term') {
    return {
      refund_amount: 0,
      refund_percentage: 0,
      policy_description:
        'Long-term booking deposits are non-refundable.',
    }
  }

  if (hoursUntilCheckIn > 7 * 24) {
    return {
      refund_amount: Math.round(refundableAmount * 100) / 100,
      refund_percentage: 100,
      policy_description: 'Cancelled more than 7 days before check-in — full refund issued (processing fee excluded).',
    }
  }

  if (hoursUntilCheckIn > 72) {
    return {
      refund_amount: Math.round(refundableAmount * 0.5 * 100) / 100,
      refund_percentage: 50,
      policy_description:
        'Cancelled within 7 days but more than 72 hours before check-in — 50% refund issued (processing fee excluded).',
    }
  }

  return {
    refund_amount: 0,
    refund_percentage: 0,
    policy_description: 'Cancelled within 72 hours of check-in — no refund issued.',
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx jest __tests__/lib/cancellation.test.ts --no-coverage
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Guard against negative refund in the cancel route**

In `app/api/bookings/[id]/cancel/route.ts`, find the Stripe refund call:

```typescript
    if (refundResult.refund_amount > 0 && booking.stripe_payment_intent_id) {
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: Math.round(refundResult.refund_amount * 100),
      })
    }
```

This is already correct (`> 0` guard). No change needed here — `calculateRefund` now returns a fee-excluded amount directly.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/cancellation.ts __tests__/lib/cancellation.test.ts
git commit -m "feat: exclude processing fee from cancellation refunds"
```

---

## Task 9: Admin Override Refund — Update for Processing Fee

**Files:**
- Modify: `app/api/bookings/[id]/cancel/route.ts`

The admin `refund_override` path computes refund as a fraction of `amount_paid`. Since `amount_paid` now includes the processing fee, admin full/half overrides should also exclude the processing fee for consistency.

- [ ] **Step 1: Update the override logic to subtract `processing_fee`**

Find the override block:

```typescript
    let refundResult = policyRefund
    if (refund_override !== undefined) {
      const amountPaid = (booking as Booking).amount_paid
      const overrideAmount =
        refund_override === 'full' ? amountPaid
        : refund_override === 'half' ? Math.round(amountPaid * 0.5 * 100) / 100
        : 0
      refundResult = {
        ...policyRefund,
        refund_amount: overrideAmount,
        refund_percentage: refund_override === 'full' ? 100 : refund_override === 'half' ? 50 : 0,
      }
    }
```

Replace with:

```typescript
    let refundResult = policyRefund
    if (refund_override !== undefined) {
      const amountPaid = (booking as Booking).amount_paid
      const processingFee = (booking as Booking).processing_fee ?? 0
      const refundableBase = amountPaid - processingFee
      const overrideAmount =
        refund_override === 'full' ? Math.round(refundableBase * 100) / 100
        : refund_override === 'half' ? Math.round(refundableBase * 0.5 * 100) / 100
        : 0
      refundResult = {
        ...policyRefund,
        refund_amount: overrideAmount,
        refund_percentage: refund_override === 'full' ? 100 : refund_override === 'half' ? 50 : 0,
      }
    }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/bookings/[id]/cancel/route.ts
git commit -m "feat: exclude processing fee from admin refund overrides"
```

---

## Task 10: End-to-End Smoke Test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify admin settings**

1. Navigate to `/admin/settings`
2. Confirm "Payment Processing" section appears with two inputs
3. Confirm defaults are `2.9` and `0.30`
4. Change to `3.0` and `0.50`, save, reload — confirm values persist

- [ ] **Step 3: Verify checkout flow**

1. Browse to a room, select dates, proceed to checkout
2. Confirm the checkout summary shows a "Processing fee" line item
3. Confirm the total reflects the fee
4. Confirm "Processing fees are non-refundable." appears below the total
5. Click "Continue to Payment"
6. Confirm "Processing fees are non-refundable." appears near the Pay button
7. Complete payment with Stripe test card `4242 4242 4242 4242`
8. Confirm booking is confirmed

- [ ] **Step 4: Verify database record**

In Supabase, check the `bookings` table — confirm `processing_fee` is non-zero and `total_amount` = subtotal + processing fee.

Check `booking_fees` — confirm a "Processing Fee" row exists with `is_refundable = false`.

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: end-to-end verification complete for processing fee passthrough"
```
