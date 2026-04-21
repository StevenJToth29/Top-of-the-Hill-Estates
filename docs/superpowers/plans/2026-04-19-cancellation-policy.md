# Configurable Cancellation Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded cancellation tiers with a 3-tier cascading policy (system → property → room) that admins can configure through the existing settings, property, and room forms.

**Architecture:** Each level stores a `cancellation_policy` JSONB column. Properties and rooms have boolean inheritance flags (`use_global_cancellation_policy` / `use_property_cancellation_policy`). A `resolvePolicy()` helper walks the chain; if all levels inherit, the system default (7 days / 72 hours / 50%) applies. `calculateRefund()` is updated to accept a `CancellationPolicy` object instead of a raw `windowHours` number.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres JSONB), TypeScript, Tailwind CSS, date-fns

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/009_cancellation_policy.sql` | Create | DB columns for policy + inheritance flags |
| `types/index.ts` | Modify | Add `CancellationPolicy` interface; update `SiteSettings`, `Property`, `Room` |
| `lib/cancellation.ts` | Modify | `DEFAULT_POLICY`, `resolvePolicy()`, updated `calculateRefund()` |
| `__tests__/lib/cancellation.test.ts` | Modify | Update tests for new `calculateRefund` signature and add `resolvePolicy` tests |
| `app/api/admin/settings/route.ts` | Modify | Pass `cancellation_policy` through PATCH handler |
| `components/admin/SettingsForm.tsx` | Modify | Add Cancellation Policy section |
| `app/api/admin/properties/route.ts` | Modify | Pass `cancellation_policy` + `use_global_cancellation_policy` |
| `components/admin/PropertyForm.tsx` | Modify | Add inheritance toggle + policy editor (like house rules) |
| `app/api/admin/rooms/route.ts` | Modify | Pass `cancellation_policy` + `use_property_cancellation_policy` |
| `components/admin/RoomForm.tsx` | Modify | Replace `cancellation_window_hours` with toggle + policy editor |
| `app/api/bookings/[id]/cancel/guest/route.ts` | Modify | Fetch room→property→settings, resolve policy |
| `app/api/bookings/[id]/cancel/route.ts` | Modify | Same for admin cancel |
| `components/public/CancellationPolicyDisplay.tsx` | Modify | Accept `policy: CancellationPolicy` prop, render dynamic rows |
| `app/(public)/booking/confirmation/page.tsx` | Modify | Resolve policy, pass to `BookingConfirmation` |
| `components/public/BookingConfirmation.tsx` | Modify | Accept `cancellationPolicy` prop, replace hardcoded strings |
| `app/(public)/booking/manage/page.tsx` | Modify | Resolve policy, pass to `BookingManageView` |
| `components/public/BookingManageView.tsx` | Modify | Accept `cancellationPolicy` prop, pass to `CancellationPolicyDisplay` |
| `app/(public)/rooms/[slug]/page.tsx` | Modify | Resolve policy, pass to `BookingWidget` |
| `components/public/BookingWidget.tsx` | Modify | Accept + pass `cancellationPolicy` to `CancellationPolicyDisplay` |

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/009_cancellation_policy.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/009_cancellation_policy.sql

-- System-level default policy (stored as JSONB in site_settings)
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS cancellation_policy JSONB;

-- Property-level: own policy + whether to inherit from system
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS cancellation_policy JSONB,
  ADD COLUMN IF NOT EXISTS use_global_cancellation_policy BOOLEAN NOT NULL DEFAULT true;

-- Room-level: own policy + whether to inherit from property chain
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS cancellation_policy JSONB,
  ADD COLUMN IF NOT EXISTS use_property_cancellation_policy BOOLEAN NOT NULL DEFAULT true;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool (or `mcp__plugin_supabase_supabase__apply_migration`) with the SQL above.

- [ ] **Step 3: Verify columns exist**

Run `SELECT column_name FROM information_schema.columns WHERE table_name IN ('site_settings','properties','rooms') AND column_name LIKE '%cancellation%'` via `mcp__supabase__execute_sql` — expect 5 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_cancellation_policy.sql
git commit -m "feat: add cancellation_policy columns to site_settings, properties, rooms"
```

---

### Task 2: Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Write the failing test** (no test needed — types compile or not; verify in Task 3's tests)

- [ ] **Step 2: Add `CancellationPolicy` interface and update existing types**

In `types/index.ts`, add after the `RefundResult` interface at the bottom:

```typescript
export interface CancellationPolicy {
  full_refund_days: number       // e.g. 7 — cancel more than this many days out → 100% refund
  partial_refund_hours: number   // e.g. 72 — cancel more than this many hours out (but within full_refund_days) → partial%
  partial_refund_percent: number // e.g. 50 — percentage refunded in the middle tier (0–100)
}
```

In the `SiteSettings` interface, add after `stripe_fee_flat`:
```typescript
  cancellation_policy?: string | null  // JSON-encoded CancellationPolicy
```

In the `Property` interface, add after `platform_fee_percent`:
```typescript
  cancellation_policy?: string | null
  use_global_cancellation_policy?: boolean
```

In the `Room` interface, add after `cancellation_window_hours`:
```typescript
  cancellation_policy?: string | null
  use_property_cancellation_policy?: boolean
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts
git commit -m "feat: add CancellationPolicy type and fields to Room, Property, SiteSettings"
```

---

### Task 3: Core Cancellation Logic

**Files:**
- Modify: `lib/cancellation.ts`
- Modify: `__tests__/lib/cancellation.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the content of `__tests__/lib/cancellation.test.ts`:

```typescript
/** @jest-environment node */
import {
  calculateRefund,
  isWithinCancellationWindow,
  resolvePolicy,
  DEFAULT_POLICY,
} from '@/lib/cancellation'
import type { Booking, CancellationPolicy } from '@/types'

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
    processing_fee: 0,
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

describe('DEFAULT_POLICY', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_POLICY).toEqual({
      full_refund_days: 7,
      partial_refund_hours: 72,
      partial_refund_percent: 50,
    })
  })
})

describe('resolvePolicy', () => {
  const systemPolicy: CancellationPolicy = { full_refund_days: 7, partial_refund_hours: 72, partial_refund_percent: 50 }
  const propertyPolicy: CancellationPolicy = { full_refund_days: 14, partial_refund_hours: 48, partial_refund_percent: 25 }
  const roomPolicy: CancellationPolicy = { full_refund_days: 3, partial_refund_hours: 24, partial_refund_percent: 0 }

  it('returns system policy when both room and property inherit', () => {
    const result = resolvePolicy(
      { use_property_cancellation_policy: true, cancellation_policy: null },
      { use_global_cancellation_policy: true, cancellation_policy: null },
      { cancellation_policy: JSON.stringify(systemPolicy) },
    )
    expect(result).toEqual(systemPolicy)
  })

  it('falls back to DEFAULT_POLICY when system has no policy set', () => {
    const result = resolvePolicy(
      { use_property_cancellation_policy: true, cancellation_policy: null },
      { use_global_cancellation_policy: true, cancellation_policy: null },
      { cancellation_policy: null },
    )
    expect(result).toEqual(DEFAULT_POLICY)
  })

  it('returns property policy when room inherits but property does not', () => {
    const result = resolvePolicy(
      { use_property_cancellation_policy: true, cancellation_policy: JSON.stringify(roomPolicy) },
      { use_global_cancellation_policy: false, cancellation_policy: JSON.stringify(propertyPolicy) },
      { cancellation_policy: JSON.stringify(systemPolicy) },
    )
    expect(result).toEqual(propertyPolicy)
  })

  it('returns room policy when room does not inherit', () => {
    const result = resolvePolicy(
      { use_property_cancellation_policy: false, cancellation_policy: JSON.stringify(roomPolicy) },
      { use_global_cancellation_policy: false, cancellation_policy: JSON.stringify(propertyPolicy) },
      { cancellation_policy: JSON.stringify(systemPolicy) },
    )
    expect(result).toEqual(roomPolicy)
  })

  it('falls back to DEFAULT_POLICY when room has no policy set even if not inheriting', () => {
    const result = resolvePolicy(
      { use_property_cancellation_policy: false, cancellation_policy: null },
      { use_global_cancellation_policy: true, cancellation_policy: null },
      null,
    )
    expect(result).toEqual(DEFAULT_POLICY)
  })
})

describe('calculateRefund', () => {
  it('returns full refund when cancelled more than full_refund_days before check-in', () => {
    const booking = makeBooking({ check_in: '2026-06-20', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-10T12:00:00Z') // 10 days before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(500)
    expect(result.refund_percentage).toBe(100)
  })

  it('returns partial% refund when cancelled within full_refund_days but outside partial_refund_hours', () => {
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-06T12:00:00Z') // 96h before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(250)
    expect(result.refund_percentage).toBe(50)
  })

  it('returns 0 refund when cancelled within partial_refund_hours', () => {
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-08T12:00:00Z') // 48h before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(0)
    expect(result.refund_percentage).toBe(0)
  })

  it('respects a custom policy with partial_refund_hours: 48', () => {
    const policy: CancellationPolicy = { full_refund_days: 7, partial_refund_hours: 48, partial_refund_percent: 50 }
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    // 60h before — outside 48h window so 50% refund
    const cancelledAt = new Date('2026-06-07T12:00:00Z')
    expect(calculateRefund(booking, cancelledAt, policy).refund_percentage).toBe(50)
  })

  it('respects a custom partial_refund_percent', () => {
    const policy: CancellationPolicy = { full_refund_days: 7, partial_refund_hours: 72, partial_refund_percent: 25 }
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-06T12:00:00Z') // 96h before, inside 7 days
    const result = calculateRefund(booking, cancelledAt, policy)
    expect(result.refund_amount).toBe(125) // 500 * 0.25
    expect(result.refund_percentage).toBe(25)
  })

  it('always returns 0 for long_term bookings', () => {
    const booking = makeBooking({ booking_type: 'long_term', check_in: '2026-06-20', amount_paid: 1000 })
    const cancelledAt = new Date('2026-05-01T12:00:00Z')
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(0)
    expect(result.refund_percentage).toBe(0)
  })

  describe('processing fee exclusion', () => {
    it('excludes processing_fee from full refund', () => {
      const booking = makeBooking({ check_in: '2030-06-20', amount_paid: 539.25, processing_fee: 14.25 })
      const cancelledAt = new Date('2030-06-10T12:00:00Z')
      expect(calculateRefund(booking, cancelledAt).refund_amount).toBe(525.00)
    })

    it('excludes processing_fee from partial refund', () => {
      const booking = makeBooking({ check_in: '2030-06-20', amount_paid: 539.25, processing_fee: 14.25 })
      const cancelledAt = new Date('2030-06-15T12:00:00Z') // 5 days before
      expect(calculateRefund(booking, cancelledAt).refund_amount).toBe(262.50)
    })

    it('returns 0 within partial_refund_hours regardless of processing_fee', () => {
      const booking = makeBooking({ check_in: '2030-06-20', amount_paid: 539.25, processing_fee: 14.25 })
      const cancelledAt = new Date('2030-06-19T12:00:00Z')
      expect(calculateRefund(booking, cancelledAt).refund_amount).toBe(0)
    })
  })
})

describe('isWithinCancellationWindow', () => {
  it('returns true when check-in is within the window', () => {
    const booking = makeBooking({ check_in: '2026-06-10' })
    const now = new Date('2026-06-08T12:00:00Z')
    expect(isWithinCancellationWindow(booking, now, 72)).toBe(true)
  })

  it('returns false when check-in is outside the window', () => {
    const booking = makeBooking({ check_in: '2026-06-10' })
    const now = new Date('2026-06-05T12:00:00Z')
    expect(isWithinCancellationWindow(booking, now, 72)).toBe(false)
  })

  it('returns true at the exact boundary', () => {
    const booking = makeBooking({ check_in: '2026-06-10' })
    const now = new Date('2026-06-07T00:00:00Z')
    expect(isWithinCancellationWindow(booking, now, 72)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/cancellation.test.ts --no-coverage
```

Expected: fails with "resolvePolicy is not a function" and "DEFAULT_POLICY is not defined".

- [ ] **Step 3: Update `lib/cancellation.ts`**

Replace the entire file:

```typescript
import type { Booking, CancellationPolicy, RefundResult } from '@/types'
import { differenceInHours } from 'date-fns/differenceInHours'
import { parseISO } from 'date-fns/parseISO'

export const DEFAULT_POLICY: CancellationPolicy = {
  full_refund_days: 7,
  partial_refund_hours: 72,
  partial_refund_percent: 50,
}

function parsePolicy(json: string | null | undefined): CancellationPolicy | null {
  if (!json) return null
  try { return JSON.parse(json) as CancellationPolicy } catch { return null }
}

/**
 * Resolves the effective cancellation policy for a booking using 3-tier cascade:
 * room (if not inheriting) → property (if not inheriting) → system → DEFAULT_POLICY
 */
export function resolvePolicy(
  room: { cancellation_policy?: string | null; use_property_cancellation_policy?: boolean | null },
  property: { cancellation_policy?: string | null; use_global_cancellation_policy?: boolean | null },
  siteSettings: { cancellation_policy?: string | null } | null,
): CancellationPolicy {
  if (room.use_property_cancellation_policy === false) {
    return parsePolicy(room.cancellation_policy) ?? DEFAULT_POLICY
  }
  if (property.use_global_cancellation_policy === false) {
    return parsePolicy(property.cancellation_policy) ?? DEFAULT_POLICY
  }
  return parsePolicy(siteSettings?.cancellation_policy) ?? DEFAULT_POLICY
}

/**
 * Calculates refund amount based on timing and the effective cancellation policy.
 * Processing fee is always excluded from any refund.
 */
export function calculateRefund(
  booking: Booking,
  cancelledAt: Date,
  policy: CancellationPolicy = DEFAULT_POLICY,
): RefundResult {
  const checkInDate = parseISO(booking.check_in)
  const hoursUntilCheckIn = differenceInHours(checkInDate, cancelledAt)
  const processingFee = booking.processing_fee ?? 0
  const refundableAmount = booking.amount_paid - processingFee

  if (booking.booking_type === 'long_term') {
    return {
      refund_amount: 0,
      refund_percentage: 0,
      policy_description: 'Long-term booking deposits are non-refundable.',
    }
  }

  if (hoursUntilCheckIn > policy.full_refund_days * 24) {
    return {
      refund_amount: Math.round(refundableAmount * 100) / 100,
      refund_percentage: 100,
      policy_description: `Cancelled more than ${policy.full_refund_days} days before check-in — full refund issued (processing fee excluded).`,
    }
  }

  if (hoursUntilCheckIn > policy.partial_refund_hours) {
    const partialAmount = Math.round(refundableAmount * (policy.partial_refund_percent / 100) * 100) / 100
    return {
      refund_amount: partialAmount,
      refund_percentage: policy.partial_refund_percent,
      policy_description: `Cancelled within ${policy.full_refund_days} days but more than ${policy.partial_refund_hours} hours before check-in — ${policy.partial_refund_percent}% refund issued (processing fee excluded).`,
    }
  }

  return {
    refund_amount: 0,
    refund_percentage: 0,
    policy_description: `Cancelled within ${policy.partial_refund_hours} hours of check-in — no refund issued.`,
  }
}

/**
 * Returns true if check-in is within the cancellation window from now.
 * Used to gate modify actions on the guest management page.
 */
export function isWithinCancellationWindow(
  booking: Booking,
  now: Date,
  windowHours = DEFAULT_POLICY.partial_refund_hours,
): boolean {
  const checkInDate = parseISO(booking.check_in)
  const hoursUntilCheckIn = differenceInHours(checkInDate, now)
  return hoursUntilCheckIn <= windowHours
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/cancellation.test.ts --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/cancellation.ts __tests__/lib/cancellation.test.ts
git commit -m "feat: add resolvePolicy(), DEFAULT_POLICY; update calculateRefund() to accept CancellationPolicy"
```

---

### Task 4: Settings Admin API + Form

**Files:**
- Modify: `app/api/admin/settings/route.ts`
- Modify: `components/admin/SettingsForm.tsx`

- [ ] **Step 1: Update `app/api/admin/settings/route.ts`**

In the `fields` object handling block, after the `stripe_fee_flat` conditional, add:

```typescript
  if (body.cancellation_policy !== undefined) fields.cancellation_policy = body.cancellation_policy
```

- [ ] **Step 2: Update `components/admin/SettingsForm.tsx`**

**2a.** Add import at top:
```typescript
import type { SiteSettings, BusinessHours, CancellationPolicy } from '@/types'
```

**2b.** Add `DEFAULT_POLICY` inline constant near the top of the component file (after imports):
```typescript
const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  full_refund_days: 7,
  partial_refund_hours: 72,
  partial_refund_percent: 50,
}
```

**2c.** Add a helper to parse/stringify the policy, after the `parseHours` function:
```typescript
function parseCancellationPolicy(json?: string | null): CancellationPolicy {
  if (!json) return DEFAULT_CANCELLATION_POLICY
  try { return { ...DEFAULT_CANCELLATION_POLICY, ...JSON.parse(json) } }
  catch { return DEFAULT_CANCELLATION_POLICY }
}
```

**2d.** Add cancellation policy state in the component, after the `hours` state line:
```typescript
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>(
    () => parseCancellationPolicy(settings.cancellation_policy)
  )
```

**2e.** In `handleSubmit`, update the fetch body to include the policy:
```typescript
body: JSON.stringify({
  ...form,
  business_hours: JSON.stringify(hours),
  global_house_rules: form.global_house_rules,
  cancellation_policy: JSON.stringify(cancellationPolicy),
}),
```

**2f.** Add the Cancellation Policy section to the form JSX, after the Payment Processing section divider (`<div className="h-px bg-outline-variant" />`):

```tsx
      <div className="h-px bg-outline-variant" />

      {/* Cancellation Policy */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold text-on-surface">
            Default Cancellation Policy
          </h2>
          <p className="text-xs text-on-surface-variant/60 mt-0.5">
            System-wide default applied to all rooms unless overridden at property or room level.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label htmlFor="full_refund_days" className={labelClass}>
              Full refund window (days)
            </label>
            <input
              id="full_refund_days"
              type="number"
              min="0"
              step="1"
              value={cancellationPolicy.full_refund_days}
              onChange={(e) =>
                setCancellationPolicy((p) => ({ ...p, full_refund_days: Number(e.target.value) }))
              }
              className={inputClass}
            />
            <p className="text-xs text-on-surface-variant/50">e.g. 7 = full refund if cancelled &gt;7 days out</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="partial_refund_hours" className={labelClass}>
              Partial refund cutoff (hours)
            </label>
            <input
              id="partial_refund_hours"
              type="number"
              min="0"
              step="1"
              value={cancellationPolicy.partial_refund_hours}
              onChange={(e) =>
                setCancellationPolicy((p) => ({ ...p, partial_refund_hours: Number(e.target.value) }))
              }
              className={inputClass}
            />
            <p className="text-xs text-on-surface-variant/50">e.g. 72 = partial% if &gt;72 hrs but within full window</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="partial_refund_percent" className={labelClass}>
              Partial refund amount (%)
            </label>
            <input
              id="partial_refund_percent"
              type="number"
              min="0"
              max="100"
              step="1"
              value={cancellationPolicy.partial_refund_percent}
              onChange={(e) =>
                setCancellationPolicy((p) => ({ ...p, partial_refund_percent: Number(e.target.value) }))
              }
              className={inputClass}
            />
            <p className="text-xs text-on-surface-variant/50">e.g. 50 = 50% refund in the middle tier</p>
          </div>
        </div>
      </section>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/settings/route.ts components/admin/SettingsForm.tsx
git commit -m "feat: add cancellation policy section to settings form and API"
```

---

### Task 5: Properties Admin API + Form

**Files:**
- Modify: `app/api/admin/properties/route.ts`
- Modify: `components/admin/PropertyForm.tsx`

- [ ] **Step 1: Update `app/api/admin/properties/route.ts`**

In the `POST` handler's `insert` object, add after `platform_fee_percent`:
```typescript
        cancellation_policy: body.cancellation_policy ?? null,
        use_global_cancellation_policy: body.use_global_cancellation_policy ?? true,
```

In the `PATCH` handler's `update` object, add after `platform_fee_percent`:
```typescript
        cancellation_policy: fields.cancellation_policy ?? null,
        use_global_cancellation_policy: fields.use_global_cancellation_policy ?? true,
```

- [ ] **Step 2: Update `components/admin/PropertyForm.tsx`**

**2a.** Read the current top of the file to find the Props interface and state setup, then add:

After the existing state declarations (around line 31-35), add:
```typescript
  const DEFAULT_CANCELLATION_POLICY = { full_refund_days: 7, partial_refund_hours: 72, partial_refund_percent: 50 }
  
  function parseCancellationPolicy(json?: string | null) {
    if (!json) return DEFAULT_CANCELLATION_POLICY
    try { return { ...DEFAULT_CANCELLATION_POLICY, ...JSON.parse(json) } }
    catch { return DEFAULT_CANCELLATION_POLICY }
  }

  const [useGlobalCancellationPolicy, setUseGlobalCancellationPolicy] = useState(
    property?.use_global_cancellation_policy ?? true
  )
  const [cancellationPolicy, setCancellationPolicy] = useState(
    () => parseCancellationPolicy(property?.cancellation_policy)
  )
```

**2b.** In the submit payload object (where `house_rules` and `use_global_house_rules` are), add:
```typescript
      cancellation_policy: useGlobalCancellationPolicy ? null : JSON.stringify(cancellationPolicy),
      use_global_cancellation_policy: useGlobalCancellationPolicy,
```

**2c.** In the JSX form, after the House Rules section (find the closing `</section>` of the house rules block), add a new section:

```tsx
      <div className="h-px bg-outline-variant" />

      {/* Cancellation Policy */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold text-on-surface">Cancellation Policy</h2>
          <p className="text-xs text-on-surface-variant/60 mt-0.5">
            Override the system cancellation policy for all rooms in this property.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={useGlobalCancellationPolicy}
          onClick={() => setUseGlobalCancellationPolicy((v) => !v)}
          className="flex items-center gap-3 group"
        >
          <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${useGlobalCancellationPolicy ? 'bg-secondary' : 'bg-surface-container'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${useGlobalCancellationPolicy ? 'translate-x-6' : 'translate-x-1'}`} />
          </span>
          <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
            Use System Cancellation Policy
          </span>
        </button>

        {!useGlobalCancellationPolicy && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="space-y-1">
              <label className="text-xs text-on-surface-variant">Full refund window (days)</label>
              <input
                type="number" min="0" step="1"
                value={cancellationPolicy.full_refund_days}
                onChange={(e) => setCancellationPolicy((p) => ({ ...p, full_refund_days: Number(e.target.value) }))}
                className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-on-surface-variant">Partial refund cutoff (hours)</label>
              <input
                type="number" min="0" step="1"
                value={cancellationPolicy.partial_refund_hours}
                onChange={(e) => setCancellationPolicy((p) => ({ ...p, partial_refund_hours: Number(e.target.value) }))}
                className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-on-surface-variant">Partial refund amount (%)</label>
              <input
                type="number" min="0" max="100" step="1"
                value={cancellationPolicy.partial_refund_percent}
                onChange={(e) => setCancellationPolicy((p) => ({ ...p, partial_refund_percent: Number(e.target.value) }))}
                className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
              />
            </div>
          </div>
        )}
      </section>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/properties/route.ts components/admin/PropertyForm.tsx
git commit -m "feat: add cancellation policy override to property form and API"
```

---

### Task 6: Rooms Admin API + Form

**Files:**
- Modify: `app/api/admin/rooms/route.ts`
- Modify: `components/admin/RoomForm.tsx`

- [ ] **Step 1: Update `app/api/admin/rooms/route.ts`**

In both `POST` and `PATCH` handlers, add to the insert/update objects (after `cancellation_window_hours`):
```typescript
      cancellation_policy: body.cancellation_policy ?? null,        // POST
      use_property_cancellation_policy: body.use_property_cancellation_policy ?? true,
```
and for PATCH:
```typescript
      cancellation_policy: fields.cancellation_policy ?? null,
      use_property_cancellation_policy: fields.use_property_cancellation_policy ?? true,
```

- [ ] **Step 2: Update `components/admin/RoomForm.tsx`**

Read the current file to find where `cancellationWindowHours` state is declared and the section where it's rendered in the form. Then:

**2a.** After the `cancellationWindowHours` state line (~line 68), add:
```typescript
  const DEFAULT_CANCELLATION_POLICY = { full_refund_days: 7, partial_refund_hours: 72, partial_refund_percent: 50 }

  function parseCancellationPolicy(json?: string | null) {
    if (!json) return DEFAULT_CANCELLATION_POLICY
    try { return { ...DEFAULT_CANCELLATION_POLICY, ...JSON.parse(json) } }
    catch { return DEFAULT_CANCELLATION_POLICY }
  }

  const [usePropertyCancellationPolicy, setUsePropertyCancellationPolicy] = useState(
    room?.use_property_cancellation_policy ?? true
  )
  const [cancellationPolicy, setCancellationPolicy] = useState(
    () => parseCancellationPolicy(room?.cancellation_policy)
  )
```

**2b.** In the submit payload, replace:
```typescript
      cancellation_window_hours: cancellationWindowHours,
```
with:
```typescript
      cancellation_window_hours: cancellationWindowHours,
      cancellation_policy: usePropertyCancellationPolicy ? null : JSON.stringify(cancellationPolicy),
      use_property_cancellation_policy: usePropertyCancellationPolicy,
```

**2c.** In the JSX form, find the `cancellation_window_hours` field section and add below it (keep the existing window hours field for reference — it's still stored but the new policy takes precedence in calculations):

```tsx
        {/* Cancellation policy override */}
        <div className="pt-1 space-y-3">
          <div>
            <p className="text-sm font-medium text-on-surface-variant">Cancellation Policy Override</p>
            <p className="text-xs text-on-surface-variant/60 mt-0.5">
              Use the property/system policy, or set a room-specific one.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={usePropertyCancellationPolicy}
            onClick={() => setUsePropertyCancellationPolicy((v) => !v)}
            className="flex items-center gap-3 group"
          >
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${usePropertyCancellationPolicy ? 'bg-secondary' : 'bg-surface-container'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${usePropertyCancellationPolicy ? 'translate-x-6' : 'translate-x-1'}`} />
            </span>
            <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
              Inherit from Property / System
            </span>
          </button>

          {!usePropertyCancellationPolicy && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-on-surface-variant">Full refund window (days)</label>
                <input
                  type="number" min="0" step="1"
                  value={cancellationPolicy.full_refund_days}
                  onChange={(e) => setCancellationPolicy((p) => ({ ...p, full_refund_days: Number(e.target.value) }))}
                  className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-on-surface-variant">Partial refund cutoff (hours)</label>
                <input
                  type="number" min="0" step="1"
                  value={cancellationPolicy.partial_refund_hours}
                  onChange={(e) => setCancellationPolicy((p) => ({ ...p, partial_refund_hours: Number(e.target.value) }))}
                  className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-on-surface-variant">Partial refund amount (%)</label>
                <input
                  type="number" min="0" max="100" step="1"
                  value={cancellationPolicy.partial_refund_percent}
                  onChange={(e) => setCancellationPolicy((p) => ({ ...p, partial_refund_percent: Number(e.target.value) }))}
                  className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                />
              </div>
            </div>
          )}
        </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/rooms/route.ts components/admin/RoomForm.tsx
git commit -m "feat: add cancellation policy override to room form and API"
```

---

### Task 7: Cancel API Routes

**Files:**
- Modify: `app/api/bookings/[id]/cancel/guest/route.ts`
- Modify: `app/api/bookings/[id]/cancel/route.ts`

- [ ] **Step 1: Update guest cancel route**

In `app/api/bookings/[id]/cancel/guest/route.ts`:

**1a.** Add `resolvePolicy` to the cancellation import:
```typescript
import { calculateRefund, resolvePolicy } from '@/lib/cancellation'
```

**1b.** Replace the room fetch block (currently fetches only `cancellation_window_hours`):

Replace:
```typescript
    const { data: room } = await supabase
      .from('rooms')
      .select('cancellation_window_hours')
      .eq('id', booking.room_id)
      .single()

    const windowHours: number = room?.cancellation_window_hours ?? 72
    const now = new Date()
    const refund = calculateRefund(booking as Booking, now, windowHours)
```

With:
```typescript
    const [{ data: room }, { data: property }, { data: siteSettings }] = await Promise.all([
      supabase
        .from('rooms')
        .select('cancellation_policy, use_property_cancellation_policy')
        .eq('id', booking.room_id)
        .single(),
      supabase
        .from('properties')
        .select('cancellation_policy, use_global_cancellation_policy')
        .eq('id', booking.property_id)
        .maybeSingle(),
      supabase
        .from('site_settings')
        .select('cancellation_policy')
        .maybeSingle(),
    ])

    const policy = resolvePolicy(room ?? {}, property ?? {}, siteSettings)
    const now = new Date()
    const refund = calculateRefund(booking as Booking, now, policy)
```

Note: `booking.property_id` must be available. If the bookings table doesn't have `property_id`, fetch it through `rooms`:
```typescript
    const { data: room } = await supabase
      .from('rooms')
      .select('property_id, cancellation_policy, use_property_cancellation_policy')
      .eq('id', booking.room_id)
      .single()

    const [{ data: property }, { data: siteSettings }] = await Promise.all([
      room?.property_id
        ? supabase
            .from('properties')
            .select('cancellation_policy, use_global_cancellation_policy')
            .eq('id', room.property_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('site_settings')
        .select('cancellation_policy')
        .maybeSingle(),
    ])

    const policy = resolvePolicy(room ?? {}, property ?? {}, siteSettings)
    const now = new Date()
    const refund = calculateRefund(booking as Booking, now, policy)
```

- [ ] **Step 2: Update admin cancel route**

In `app/api/bookings/[id]/cancel/route.ts`:

**2a.** Add `resolvePolicy` to the import:
```typescript
import { calculateRefund, resolvePolicy } from '@/lib/cancellation'
```

**2b.** Replace the `calculateRefund` call (currently `calculateRefund(booking as Booking, now)` with no policy):

After `const now = new Date()`, replace:
```typescript
    const policyRefund = calculateRefund(booking as Booking, now)
```
with:
```typescript
    const { data: room } = await supabase
      .from('rooms')
      .select('property_id, cancellation_policy, use_property_cancellation_policy')
      .eq('id', (booking as Booking).room_id)
      .single()

    const [{ data: property }, { data: siteSettings }] = await Promise.all([
      room?.property_id
        ? supabase
            .from('properties')
            .select('cancellation_policy, use_global_cancellation_policy')
            .eq('id', room.property_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('site_settings')
        .select('cancellation_policy')
        .maybeSingle(),
    ])

    const policy = resolvePolicy(room ?? {}, property ?? {}, siteSettings)
    const policyRefund = calculateRefund(booking as Booking, now, policy)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Run existing cancel tests**

```bash
npx jest __tests__/api/bookings-cancel-guest.test.ts --no-coverage
```

Expected: all pass (the tests mock Supabase so extra selects need to be accommodated — if tests fail due to missing mocks, add the room/property/settings select mocks returning `{ data: null }`).

- [ ] **Step 5: Commit**

```bash
git add app/api/bookings/[id]/cancel/guest/route.ts app/api/bookings/[id]/cancel/route.ts
git commit -m "feat: resolve cascading cancellation policy in cancel API routes"
```

---

### Task 8: CancellationPolicyDisplay Component

**Files:**
- Modify: `components/public/CancellationPolicyDisplay.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire file:

```typescript
import type { BookingType, CancellationPolicy } from '@/types'

interface Props {
  variant?: BookingType
  policy: CancellationPolicy
}

export default function CancellationPolicyDisplay({ variant = 'short_term', policy }: Props) {
  if (variant === 'long_term') {
    return (
      <div className="bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-5 space-y-4">
        <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
          Cancellation Policy
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl px-4 py-3 bg-error/10">
            <span className="text-sm text-on-surface-variant">Deposit</span>
            <span className="text-sm font-semibold text-error">Non-refundable</span>
          </div>
        </div>
      </div>
    )
  }

  const rows = [
    {
      condition: `> ${policy.full_refund_days} days before check-in`,
      refund: 'Full refund',
      color: 'text-green-400',
      bg: 'bg-green-400/10',
    },
    {
      condition: `> ${policy.partial_refund_hours} hrs but ≤ ${policy.full_refund_days} days`,
      refund: `${policy.partial_refund_percent}% refund`,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
    },
    {
      condition: `≤ ${policy.partial_refund_hours} hours before check-in`,
      refund: 'No refund',
      color: 'text-error',
      bg: 'bg-error/10',
    },
  ]

  return (
    <div className="bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-5 space-y-4">
      <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
        Cancellation Policy
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.condition}
            className={`flex items-center justify-between rounded-xl px-4 py-3 ${row.bg}`}
          >
            <span className="text-sm text-on-surface-variant">{row.condition}</span>
            <span className={`text-sm font-semibold ${row.color}`}>{row.refund}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: errors about missing `policy` prop at all call sites — these are fixed in the next tasks.

- [ ] **Step 3: Commit** (after fixing call sites in Tasks 9–11)

Commit together with the call-site fixes in Task 11.

---

### Task 9: Booking Confirmation Page + Component

**Files:**
- Modify: `app/(public)/booking/confirmation/page.tsx`
- Modify: `components/public/BookingConfirmation.tsx`

- [ ] **Step 1: Update confirmation page to resolve and pass policy**

In `app/(public)/booking/confirmation/page.tsx`:

**1a.** Add imports:
```typescript
import { resolvePolicy } from '@/lib/cancellation'
import type { Booking, Room, Property, BookingFee, CancellationPolicy } from '@/types'
```

**1b.** Update the settings fetch to also get `cancellation_policy`:
```typescript
    publicSupabase
      .from('site_settings')
      .select('contact_phone, contact_email, cancellation_policy')
      .maybeSingle(),
```

**1c.** After the booking validation (`if (error || !booking ...)`), resolve the policy:
```typescript
  const resolvedPolicy = resolvePolicy(
    typedBooking.room,
    typedBooking.room.property,
    settings,
  )
```

(Note: `typedBooking.room` has `cancellation_policy` and `use_property_cancellation_policy` because the booking select is `rooms(*, property:properties(*))`, which selects all columns.)

**1d.** Pass `cancellationPolicy` to `BookingConfirmation`:
```tsx
      <BookingConfirmation
        booking={typedBooking}
        bookingFees={(bookingFees ?? []) as BookingFee[]}
        contactPhone={settings?.contact_phone ?? undefined}
        contactEmail={settings?.contact_email ?? undefined}
        cancellationPolicy={resolvedPolicy}
      />
```

- [ ] **Step 2: Update `BookingConfirmation` component**

In `components/public/BookingConfirmation.tsx`:

**2a.** Add import:
```typescript
import type { Booking, Room, Property, BookingFee, CancellationPolicy } from '@/types'
```

**2b.** Remove the hardcoded policy constants:
```typescript
// DELETE these two lines:
const SHORT_TERM_POLICY = 'Full refund if cancelled more than 7 days before check-in...'
const LONG_TERM_POLICY = 'Deposit is non-refundable...'
```

**2c.** Add `cancellationPolicy` prop to the component:
```typescript
export default function BookingConfirmation({
  booking,
  bookingFees,
  contactPhone,
  contactEmail,
  cancellationPolicy,
}: {
  booking: BookingWithRoom
  bookingFees: BookingFee[]
  contactPhone?: string
  contactEmail?: string
  cancellationPolicy: CancellationPolicy
}) {
```

**2d.** Replace the `cancellationPolicy` constant computed from `isLongTerm`:
```typescript
  // Remove: const cancellationPolicy = isLongTerm ? LONG_TERM_POLICY : SHORT_TERM_POLICY
```

**2e.** Replace both places where the old `cancellationPolicy` string is used in JSX:

In the Cancellation Policy section:
```tsx
        <p className="font-body text-on-surface-variant text-sm leading-relaxed">
          {isLongTerm
            ? 'Deposit is non-refundable. Please review your lease agreement for full cancellation terms.'
            : `Full refund if cancelled more than ${cancellationPolicy.full_refund_days} days before check-in. ${cancellationPolicy.partial_refund_percent}% refund if cancelled more than ${cancellationPolicy.partial_refund_hours} hours but within ${cancellationPolicy.full_refund_days} days. No refund within ${cancellationPolicy.partial_refund_hours} hours of check-in.`
          }
        </p>
```

In the Cancel Reservation section (`<p className="text-on-surface-variant text-sm">` that shows the policy):
```tsx
          <p className="text-on-surface-variant text-sm">
            {isLongTerm
              ? 'Deposit is non-refundable.'
              : `Full refund if cancelled more than ${cancellationPolicy.full_refund_days} days before check-in. ${cancellationPolicy.partial_refund_percent}% refund if cancelled more than ${cancellationPolicy.partial_refund_hours} hours but within ${cancellationPolicy.full_refund_days} days. No refund within ${cancellationPolicy.partial_refund_hours} hours.`
            }
          </p>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: fewer errors than after Task 8 — remaining errors will be in manage page and rooms page.

- [ ] **Step 4: Commit** (after Tasks 10 and 11 fix remaining call sites)

---

### Task 10: Manage Booking Page

**Files:**
- Modify: `app/(public)/booking/manage/page.tsx`
- Modify: `components/public/BookingManageView.tsx`

- [ ] **Step 1: Update manage page**

In `app/(public)/booking/manage/page.tsx`:

**1a.** Add imports:
```typescript
import { isWithinCancellationWindow, calculateRefund, resolvePolicy } from '@/lib/cancellation'
import type { Booking, Room, Property, BookingModificationRequest, CancellationPolicy } from '@/types'
```

**1b.** Update the site_settings fetch to also select `cancellation_policy`. After the booking query, add a settings fetch:
```typescript
  const { data: siteSettings } = await supabase
    .from('site_settings')
    .select('cancellation_policy')
    .maybeSingle()
```

**1c.** After the `booking` validation block (where `windowHours` is set), resolve the policy:
```typescript
  const resolvedPolicy = resolvePolicy(booking.room, booking.room.property, siteSettings)
  const windowHours: number = resolvedPolicy.partial_refund_hours
  const now = new Date()
  const withinWindow = isWithinCancellationWindow(booking, now, windowHours)
  const refund = calculateRefund(booking, now, resolvedPolicy)
```

(Remove the old `const windowHours: number = booking.room.cancellation_window_hours ?? 72` line.)

**1d.** Pass `cancellationPolicy` to `BookingManageView`:
```tsx
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
        cancellationPolicy={resolvedPolicy}
      />
```

- [ ] **Step 2: Update `BookingManageView` component**

Read the file first (`components/public/BookingManageView.tsx`) to find:
- Where `CancellationPolicyDisplay` is imported and used
- The props interface

**2a.** Add `cancellationPolicy: CancellationPolicy` to the props interface.

**2b.** Add to the import:
```typescript
import type { ..., CancellationPolicy } from '@/types'
```

**2c.** Find all usages of `<CancellationPolicyDisplay` and pass the `policy` prop:
```tsx
<CancellationPolicyDisplay
  variant={booking.booking_type}
  policy={cancellationPolicy}
/>
```

**2d.** Find any hardcoded policy strings in the component and replace them using `cancellationPolicy`:
```typescript
// If there's a string like:
// 'Full refund if cancelled more than 7 days...'
// Replace with dynamic version:
const policyText = booking.booking_type === 'long_term'
  ? 'Deposit is non-refundable.'
  : `Full refund if cancelled more than ${cancellationPolicy.full_refund_days} days before check-in. ${cancellationPolicy.partial_refund_percent}% refund if cancelled more than ${cancellationPolicy.partial_refund_hours} hours but within ${cancellationPolicy.full_refund_days} days. No refund within ${cancellationPolicy.partial_refund_hours} hours.`
```

- [ ] **Step 3: Commit** (after Task 11 fixes remaining call sites)

---

### Task 11: Room Listing Page + BookingWidget

**Files:**
- Modify: `app/(public)/rooms/[slug]/page.tsx`
- Modify: `components/public/BookingWidget.tsx`

- [ ] **Step 1: Update rooms/[slug]/page.tsx**

In `app/(public)/rooms/[slug]/page.tsx`:

**1a.** Add import:
```typescript
import { resolvePolicy } from '@/lib/cancellation'
import type { ..., CancellationPolicy } from '@/types'
```

**1b.** Update the site_settings select to also include `cancellation_policy`:
```typescript
  const { data: settings } = await supabase
    .from('site_settings')
    .select('stripe_fee_percent, stripe_fee_flat, cancellation_policy')
    .maybeSingle()
```

**1c.** After the room fetch and before returning JSX, resolve the policy:
```typescript
  const resolvedPolicy = resolvePolicy(
    room,
    room.property,
    settings,
  )
```

(The room select should include `cancellation_policy, use_property_cancellation_policy` — verify the select query uses `*` which would include them automatically.)

**1d.** Pass `cancellationPolicy` to `BookingWidget`:
```tsx
  <BookingWidget
    room={room}
    initialCheckin={searchParams.checkin ?? ''}
    initialCheckout={searchParams.checkout ?? ''}
    initialGuests={Number(searchParams.guests ?? 1)}
    stripeFeePercent={settings?.stripe_fee_percent ?? 2.9}
    stripeFeeFlat={settings?.stripe_fee_flat ?? 0.30}
    cancellationPolicy={resolvedPolicy}
  />
```

- [ ] **Step 2: Update `BookingWidget` component**

**2a.** Add `cancellationPolicy: CancellationPolicy` to the props interface.

**2b.** Add import:
```typescript
import type { ..., CancellationPolicy } from '@/types'
```

**2c.** Find the `<CancellationPolicyDisplay` usage in `BookingWidget` and pass the policy:
```tsx
<CancellationPolicyDisplay
  variant={bookingType}
  policy={cancellationPolicy}
/>
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit all pending changes from Tasks 8–11**

```bash
git add \
  components/public/CancellationPolicyDisplay.tsx \
  app/(public)/booking/confirmation/page.tsx \
  components/public/BookingConfirmation.tsx \
  app/(public)/booking/manage/page.tsx \
  components/public/BookingManageView.tsx \
  app/(public)/rooms/[slug]/page.tsx \
  components/public/BookingWidget.tsx
git commit -m "feat: wire dynamic cancellation policy through public booking pages and components"
```

---

## Self-Review Checklist

- [ ] All 3 admin forms (Settings, Property, Room) save and load `cancellation_policy` correctly
- [ ] Inheritance chain: room → property → system → DEFAULT_POLICY
- [ ] `calculateRefund` uses `partial_refund_percent` correctly (not always 50%)
- [ ] Cancel APIs (guest + admin) resolve policy before calculating refund
- [ ] `CancellationPolicyDisplay` shows dynamic values, not hardcoded 7/72/50
- [ ] `BookingConfirmation` text is dynamic
- [ ] TypeScript compiles with no errors
- [ ] All existing tests pass
