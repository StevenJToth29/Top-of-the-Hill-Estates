# Payment Method Configuration by Booking Type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to configure which Stripe payment methods are available per booking type (short-term / long-term) and set a per-method fee that replaces the base processing fee; ACH-only long-term and all-methods short-term by default.

**Architecture:** A new `payment_method_configs` table stores one row per (booking_type × method_key). `POST /api/bookings` queries enabled methods to restrict the PaymentIntent and returns available methods to the frontend. A new `PATCH /api/bookings/[id]/payment-method` endpoint updates the PaymentIntent amount and processing_fee snapshot once the guest confirms their method. Admins configure methods from a new section in the Settings page.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres + service role client), Stripe Node SDK, React 19, Tailwind CSS, Jest + Testing Library

---

## File Map

**New files:**
- `supabase/migrations/009_payment_method_configs.sql` — table DDL + seed data
- `app/api/admin/payment-method-configs/route.ts` — GET (list all configs)
- `app/api/admin/payment-method-configs/[id]/route.ts` — PATCH (update single config)
- `app/api/bookings/[id]/payment-method/route.ts` — PATCH (finalize fee before payment)
- `components/public/PaymentMethodFeeInfo.tsx` — read-only fee info block shown in checkout
- `__tests__/api/admin/payment-method-configs.test.ts` — admin config route tests
- `__tests__/api/bookings/payment-method.test.ts` — payment-method PATCH tests

**Modified files:**
- `types/index.ts` — add `PaymentMethodConfig` interface
- `app/api/bookings/route.ts` — query configs, set `payment_method_types`, no fee at creation
- `components/public/StripePaymentSection.tsx` — track selected method, PATCH before confirm
- `components/public/CheckoutForm.tsx` — store available methods, show `PaymentMethodFeeInfo`
- `components/public/CheckoutSummary.tsx` — add fee-varies note
- `components/public/CheckoutPageInner.tsx` — remove `stripeFeePercent/Flat`, init fee=0
- `app/(public)/checkout/page.tsx` — remove `stripe_fee_percent/flat` settings fetch
- `components/admin/SettingsForm.tsx` — add Payment Methods section
- `app/admin/(protected)/settings/page.tsx` — fetch and pass payment method configs

---

## Task 1: Database Migration + TypeScript Type

**Files:**
- Create: `supabase/migrations/009_payment_method_configs.sql`
- Modify: `types/index.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/009_payment_method_configs.sql`:

```sql
CREATE TABLE payment_method_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('short_term', 'long_term')),
  method_key   TEXT NOT NULL,
  label        TEXT NOT NULL,
  is_enabled   BOOLEAN NOT NULL DEFAULT true,
  fee_percent  NUMERIC NOT NULL DEFAULT 0,
  fee_flat     NUMERIC NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_type, method_key)
);

ALTER TABLE payment_method_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON payment_method_configs
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO payment_method_configs
  (booking_type, method_key, label, is_enabled, fee_percent, fee_flat, sort_order)
VALUES
  ('short_term', 'card',            'Credit / Debit Card', true,  2.9, 0.30, 1),
  ('short_term', 'us_bank_account', 'ACH Bank Transfer',   true,  0,   0,    2),
  ('short_term', 'cashapp',         'Cash App Pay',        true,  2.9, 0.30, 3),
  ('long_term',  'card',            'Credit / Debit Card', false, 2.9, 0.30, 1),
  ('long_term',  'us_bank_account', 'ACH Bank Transfer',   true,  0,   0,    2),
  ('long_term',  'cashapp',         'Cash App Pay',        false, 2.9, 0.30, 3);
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies without error, 6 rows inserted.

- [ ] **Step 3: Add TypeScript type**

In `types/index.ts`, add after the `BookingFee` interface:

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

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_payment_method_configs.sql types/index.ts
git commit -m "feat: add payment_method_configs table and PaymentMethodConfig type"
```

---

## Task 2: Admin GET — List Payment Method Configs

**Files:**
- Create: `app/api/admin/payment-method-configs/route.ts`
- Create: `__tests__/api/admin/payment-method-configs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/admin/payment-method-configs.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { GET } from '@/app/api/admin/payment-method-configs/route'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

const mockCreateServerClient = createServerSupabaseClient as jest.Mock
const mockCreateServiceClient = createServiceRoleClient as jest.Mock

const authedUser = { id: 'user-1', email: 'admin@test.com' }

function createDbMocks(opts: { data?: unknown[]; queryError?: unknown } = {}) {
  const orderFinal = jest.fn().mockResolvedValue({
    data: opts.data ?? [],
    error: opts.queryError ?? null,
  })
  const orderFirst = jest.fn().mockReturnValue({ order: orderFinal })
  const select = jest.fn().mockReturnValue({ order: orderFirst })
  const from = jest.fn().mockReturnValue({ select })
  return { from, select, orderFirst, orderFinal }
}

beforeEach(() => {
  mockCreateServerClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: authedUser }, error: null }),
    },
  })
})

afterEach(() => jest.resetAllMocks())

describe('GET /api/admin/payment-method-configs – auth', () => {
  test('returns 401 when not authenticated', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    const res = await GET()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })
})

describe('GET /api/admin/payment-method-configs – success', () => {
  test('returns configs array', async () => {
    const configs = [
      { id: '1', booking_type: 'short_term', method_key: 'card', label: 'Credit / Debit Card', is_enabled: true, fee_percent: 2.9, fee_flat: 0.30, sort_order: 1 },
      { id: '2', booking_type: 'long_term', method_key: 'us_bank_account', label: 'ACH Bank Transfer', is_enabled: true, fee_percent: 0, fee_flat: 0, sort_order: 2 },
    ]
    const db = createDbMocks({ data: configs })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.configs).toHaveLength(2)
    expect(body.configs[0].method_key).toBe('card')
  })

  test('returns 500 on database error', async () => {
    const db = createDbMocks({ queryError: { message: 'connection refused' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await GET()

    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/api/admin/payment-method-configs.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/admin/payment-method-configs/route'`

- [ ] **Step 3: Implement the route**

Create `app/api/admin/payment-method-configs/route.ts`:

```ts
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('payment_method_configs')
    .select('*')
    .order('booking_type')
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ configs: data })
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest __tests__/api/admin/payment-method-configs.test.ts --no-coverage
```

Expected: PASS

---

## Task 3: Admin PATCH — Update Single Config

**Files:**
- Create: `app/api/admin/payment-method-configs/[id]/route.ts`
- Modify: `__tests__/api/admin/payment-method-configs.test.ts` (append PATCH tests)

- [ ] **Step 1: Append PATCH tests**

Add to `__tests__/api/admin/payment-method-configs.test.ts`:

```ts
import { GET, /* add: */ } from '@/app/api/admin/payment-method-configs/route'
// Replace the import line with:
import { GET } from '@/app/api/admin/payment-method-configs/route'
import { PATCH } from '@/app/api/admin/payment-method-configs/[id]/route'
```

Replace the existing import at the top of the test file with:

```ts
import { GET } from '@/app/api/admin/payment-method-configs/route'
import { PATCH } from '@/app/api/admin/payment-method-configs/[id]/route'
```

Append these tests at the bottom of `__tests__/api/admin/payment-method-configs.test.ts`:

```ts
function makePatchRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/payment-method-configs/config-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createPatchDbMocks(opts: { updateError?: unknown } = {}) {
  const eq = jest.fn().mockResolvedValue({ error: opts.updateError ?? null })
  const update = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ update })
  return { from, update, eq }
}

const patchParams = { id: 'config-1' }

describe('PATCH /api/admin/payment-method-configs/[id] – auth', () => {
  test('returns 401 when not authenticated', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    const db = createPatchDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })
    const res = await PATCH(makePatchRequest({}), { params: patchParams })
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/admin/payment-method-configs/[id] – update', () => {
  test('updates is_enabled and sets updated_at', async () => {
    const db = createPatchDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makePatchRequest({ is_enabled: false }), { params: patchParams })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    const fields = db.update.mock.calls[0][0]
    expect(fields.is_enabled).toBe(false)
    expect(fields.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(db.eq).toHaveBeenCalledWith('id', 'config-1')
  })

  test('updates fee_percent and fee_flat', async () => {
    const db = createPatchDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makePatchRequest({ fee_percent: 1.5, fee_flat: 0.50 }), { params: patchParams })

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ fee_percent: 1.5, fee_flat: 0.50 })
    )
  })

  test('omits undefined fields', async () => {
    const db = createPatchDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makePatchRequest({ is_enabled: true }), { params: patchParams })

    const fields = db.update.mock.calls[0][0]
    expect(fields).not.toHaveProperty('fee_percent')
    expect(fields).not.toHaveProperty('fee_flat')
  })

  test('returns 500 on database error', async () => {
    const db = createPatchDbMocks({ updateError: { message: 'constraint violation' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makePatchRequest({ is_enabled: true }), { params: patchParams })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'constraint violation' })
  })
})
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
npx jest __tests__/api/admin/payment-method-configs.test.ts --no-coverage
```

Expected: FAIL on PATCH tests — `Cannot find module '.../[id]/route'`

- [ ] **Step 3: Implement the PATCH route**

Create `app/api/admin/payment-method-configs/[id]/route.ts`:

```ts
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const body = await request.json()

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.is_enabled !== undefined) fields.is_enabled = body.is_enabled
  if (body.fee_percent !== undefined) fields.fee_percent = body.fee_percent
  if (body.fee_flat !== undefined) fields.fee_flat = body.fee_flat

  const { error } = await supabase
    .from('payment_method_configs')
    .update(fields)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run all config tests to confirm they pass**

```bash
npx jest __tests__/api/admin/payment-method-configs.test.ts --no-coverage
```

Expected: PASS (all GET + PATCH tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/payment-method-configs/ __tests__/api/admin/payment-method-configs.test.ts
git commit -m "feat: add admin payment-method-configs GET and PATCH routes"
```

---

## Task 4: Booking PATCH — Finalize Payment Method Fee

**Files:**
- Create: `app/api/bookings/[id]/payment-method/route.ts`
- Create: `__tests__/api/bookings/payment-method.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/bookings/payment-method.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { PATCH } from '@/app/api/bookings/[id]/payment-method/route'
import { createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}))

jest.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: { update: jest.fn() },
  },
}))

const mockCreateServiceClient = createServiceRoleClient as jest.Mock
const mockStripeUpdate = (stripe.paymentIntents.update as jest.Mock)

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/bookings/booking-1/payment-method', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const routeParams = { params: { id: 'booking-1' } }

const defaultBooking = {
  id: 'booking-1',
  booking_type: 'short_term',
  total_amount: 500,
  processing_fee: 0,
  status: 'pending',
  stripe_payment_intent_id: 'pi_test_123',
}

const cardConfig = { fee_percent: 2.9, fee_flat: 0.30, is_enabled: true }

function createDbMocks(opts: {
  booking?: unknown
  bookingError?: unknown
  config?: unknown
  configError?: unknown
  updateError?: unknown
} = {}) {
  const updateEq = jest.fn().mockResolvedValue({ error: opts.updateError ?? null })
  const update = jest.fn().mockReturnValue({ eq: updateEq })

  const configSingle = jest.fn().mockResolvedValue({
    data: opts.config !== undefined ? opts.config : cardConfig,
    error: opts.configError ?? null,
  })
  const configEqMethod = jest.fn().mockReturnValue({ single: configSingle })
  const configEqType = jest.fn().mockReturnValue({ eq: configEqMethod })
  const configSelect = jest.fn().mockReturnValue({ eq: configEqType })

  const bookingSingle = jest.fn().mockResolvedValue({
    data: opts.booking !== undefined ? opts.booking : defaultBooking,
    error: opts.bookingError ?? null,
  })
  const bookingEq = jest.fn().mockReturnValue({ single: bookingSingle })
  const bookingSelect = jest.fn().mockReturnValue({ eq: bookingEq })

  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'bookings') return { select: bookingSelect, update }
    if (table === 'payment_method_configs') return { select: configSelect }
    return {}
  })

  return { from, update, updateEq }
}

beforeEach(() => {
  mockStripeUpdate.mockResolvedValue({})
})

afterEach(() => jest.resetAllMocks())

describe('PATCH /api/bookings/[id]/payment-method – validation', () => {
  test('returns 400 when method_key is missing', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({}), routeParams)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'method_key is required' })
  })

  test('returns 404 when booking not found', async () => {
    const db = createDbMocks({ booking: null, bookingError: { message: 'not found' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({ method_key: 'card' }), routeParams)
    expect(res.status).toBe(404)
  })

  test('returns 400 when booking status is not pending', async () => {
    const db = createDbMocks({ booking: { ...defaultBooking, status: 'confirmed' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({ method_key: 'card' }), routeParams)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Booking is not in pending status' })
  })

  test('returns 400 when method config not found', async () => {
    const db = createDbMocks({ config: null, configError: { message: 'not found' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({ method_key: 'unknown_method' }), routeParams)
    expect(res.status).toBe(400)
  })

  test('returns 400 when method is disabled', async () => {
    const db = createDbMocks({ config: { ...cardConfig, is_enabled: false } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({ method_key: 'card' }), routeParams)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Payment method not available' })
  })
})

describe('PATCH /api/bookings/[id]/payment-method – fee calculation', () => {
  test('calculates percent + flat fee and updates PaymentIntent', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({ method_key: 'card' }), routeParams)

    expect(res.status).toBe(200)
    const body = await res.json()
    // base=500, fee = 500 * 2.9% + $0.30 = $14.50 + $0.30 = $14.80
    expect(body.processing_fee).toBe(14.80)
    expect(body.grand_total).toBe(514.80)
    expect(mockStripeUpdate).toHaveBeenCalledWith('pi_test_123', { amount: 51480 })
  })

  test('calculates zero fee correctly', async () => {
    const db = createDbMocks({ config: { fee_percent: 0, fee_flat: 0, is_enabled: true } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({ method_key: 'us_bank_account' }), routeParams)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processing_fee).toBe(0)
    expect(body.grand_total).toBe(500)
    expect(mockStripeUpdate).toHaveBeenCalledWith('pi_test_123', { amount: 50000 })
  })

  test('re-calculates from base when method is changed (booking already has fee applied)', async () => {
    // Guest previously selected card ($14.80 fee), now switching to ACH ($5 flat)
    const bookingWithFee = { ...defaultBooking, total_amount: 514.80, processing_fee: 14.80 }
    const db = createDbMocks({
      booking: bookingWithFee,
      config: { fee_percent: 0, fee_flat: 5, is_enabled: true },
    })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({ method_key: 'us_bank_account' }), routeParams)

    expect(res.status).toBe(200)
    const body = await res.json()
    // base = 514.80 - 14.80 = 500; new fee = $5 flat; new total = $505
    expect(body.processing_fee).toBe(5)
    expect(body.grand_total).toBe(505)
    expect(mockStripeUpdate).toHaveBeenCalledWith('pi_test_123', { amount: 50500 })
  })

  test('updates booking processing_fee and total_amount', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest({ method_key: 'card' }), routeParams)

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_fee: 14.80, total_amount: 514.80 })
    )
    expect(db.updateEq).toHaveBeenCalledWith('id', 'booking-1')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/api/bookings/payment-method.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/bookings/[id]/payment-method/route'`

- [ ] **Step 3: Implement the route**

Create `app/api/bookings/[id]/payment-method/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json()
    const { method_key } = body

    if (!method_key) {
      return NextResponse.json({ error: 'method_key is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booking_type, total_amount, processing_fee, status, stripe_payment_intent_id')
      .eq('id', params.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status !== 'pending') {
      return NextResponse.json({ error: 'Booking is not in pending status' }, { status: 400 })
    }

    const { data: methodConfig, error: configError } = await supabase
      .from('payment_method_configs')
      .select('fee_percent, fee_flat, is_enabled')
      .eq('booking_type', booking.booking_type)
      .eq('method_key', method_key)
      .single()

    if (configError || !methodConfig) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 400 })
    }

    if (!methodConfig.is_enabled) {
      return NextResponse.json({ error: 'Payment method not available' }, { status: 400 })
    }

    // Derive base amount so repeated PATCH calls (method changes) stay correct
    const base_amount = Number(booking.total_amount) - Number(booking.processing_fee ?? 0)
    const processing_fee = Math.round(
      (base_amount * (Number(methodConfig.fee_percent) / 100) + Number(methodConfig.fee_flat)) * 100
    ) / 100
    const grand_total = base_amount + processing_fee

    await stripe.paymentIntents.update(booking.stripe_payment_intent_id!, {
      amount: Math.round(grand_total * 100),
    })

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ processing_fee, total_amount: grand_total })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ processing_fee, grand_total })
  } catch (err) {
    console.error('payment-method PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/api/bookings/payment-method.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/bookings/[id]/payment-method/route.ts __tests__/api/bookings/payment-method.test.ts
git commit -m "feat: add payment-method PATCH route to finalize fee before payment confirm"
```

---

## Task 5: Modify POST /api/bookings — Query Configs, Remove Upfront Fee

**Files:**
- Modify: `app/api/bookings/route.ts`

- [ ] **Step 1: Update the import**

In `app/api/bookings/route.ts`, add `PaymentMethodConfig` to the types import:

```ts
import type { Booking, BookingType, PaymentMethodConfig } from '@/types'
```

- [ ] **Step 2: Replace the fee calculation and PaymentIntent creation**

In `app/api/bookings/route.ts`, find and replace the block starting with `const { data: siteSettings }` through the `paymentIntent` creation:

**Find** (lines ~60–140):

```ts
    const { data: siteSettings } = await supabase
      .from('site_settings')
      .select('stripe_fee_percent, stripe_fee_flat')
      .limit(1)
      .single()

    const stripeFeePercent = Number(siteSettings?.stripe_fee_percent ?? 2.9)
    const stripeFeeFlat = Number(siteSettings?.stripe_fee_flat ?? 0.30)
```

**Replace with:**

```ts
    const { data: paymentMethodConfigs, error: configsError } = await supabase
      .from('payment_method_configs')
      .select('id, method_key, label, fee_percent, fee_flat, sort_order')
      .eq('booking_type', booking_type)
      .eq('is_enabled', true)
      .order('sort_order')

    if (configsError) {
      console.error('Failed to fetch payment method configs:', configsError)
      return NextResponse.json({ error: 'Failed to fetch payment configuration' }, { status: 500 })
    }

    const enabledMethods = (paymentMethodConfigs ?? []) as PaymentMethodConfig[]

    if (enabledMethods.length === 0) {
      return NextResponse.json(
        { error: 'No payment methods available for this booking type. Please contact support.' },
        { status: 422 },
      )
    }
```

- [ ] **Step 3: Remove the processing fee calculation**

Find and remove (or replace) these lines:

```ts
    const processing_fee = Math.round(
      (total_amount * (stripeFeePercent / 100) + stripeFeeFlat) * 100
    ) / 100
    const grand_total = total_amount + processing_fee

    const amount_to_pay = grand_total
    const amount_due_at_checkin = 0
```

**Replace with:**

```ts
    const amount_due_at_checkin = 0
```

- [ ] **Step 4: Update the PaymentIntent creation**

Find the `paymentIntent` creation block and replace it:

**Find:**
```ts
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount_to_pay * 100),
      currency: 'usd',
      metadata: { room_id, booking_type, guest_email },
      ...(connectedAccountId && {
        transfer_data: { destination: connectedAccountId },
        application_fee_amount: Math.round(amount_to_pay * (platformFeePercent / 100) * 100),
      }),
    })
```

**Replace with:**
```ts
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total_amount * 100),
      currency: 'usd',
      payment_method_types: enabledMethods.map((m) => m.method_key),
      metadata: { room_id, booking_type, guest_email },
      ...(connectedAccountId && {
        transfer_data: { destination: connectedAccountId },
        application_fee_amount: Math.round(total_amount * (platformFeePercent / 100) * 100),
      }),
    })
```

- [ ] **Step 5: Update the booking insert**

Find the booking insert and change `total_amount: grand_total` to `total_amount: total_amount` and `processing_fee` to `0`:

```ts
      .insert({
        // ... existing fields ...
        total_amount,           // was: grand_total
        processing_fee: 0,      // was: processing_fee (calculated value)
        amount_paid: 0,
        amount_due_at_checkin,
        // ...
      })
```

- [ ] **Step 6: Update the return statement**

Find the return at the end of the route (the `NextResponse.json` that returns `clientSecret`). Add `available_payment_methods`:

**Find:**
```ts
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      bookingId: booking.id,
      processing_fee: processing_fee,
    })
```

**Replace with:**
```ts
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      bookingId: booking.id,
      processing_fee: 0,
      available_payment_methods: enabledMethods,
    })
```

- [ ] **Step 7: Run the full test suite to verify nothing regressed**

```bash
npx jest --no-coverage
```

Expected: all existing tests pass (the `amount_due_at_checkin = 0` and existing booking tests should still pass)

- [ ] **Step 8: Commit**

```bash
git add app/api/bookings/route.ts
git commit -m "feat: use payment_method_configs to restrict PaymentIntent methods; defer fee to method confirmation"
```

---

## Task 6: PaymentMethodFeeInfo Component

**Files:**
- Create: `components/public/PaymentMethodFeeInfo.tsx`

- [ ] **Step 1: Implement the component**

Create `components/public/PaymentMethodFeeInfo.tsx`:

```tsx
import type { PaymentMethodConfig } from '@/types'

function formatFee(percent: number, flat: number): string {
  const p = Number(percent)
  const f = Number(flat)
  if (p === 0 && f === 0) return 'No processing fee'
  if (p === 0) return `$${f.toFixed(2)} flat`
  if (f === 0) return `${p}%`
  return `${p}% + $${f.toFixed(2)}`
}

interface PaymentMethodFeeInfoProps {
  methods: PaymentMethodConfig[]
}

export default function PaymentMethodFeeInfo({ methods }: PaymentMethodFeeInfoProps) {
  if (methods.length === 0) return null

  return (
    <div className="bg-surface-highest/40 rounded-xl p-4 space-y-2">
      <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wide">
        Payment Method Fees
      </p>
      <ul className="space-y-1">
        {methods.map((m) => (
          <li key={m.method_key} className="flex justify-between text-sm">
            <span className="text-on-surface-variant">{m.label}</span>
            <span className="text-on-surface">{formatFee(m.fee_percent, m.fee_flat)}</span>
          </li>
        ))}
      </ul>
      <p className="text-on-surface-variant/60 text-xs italic">
        Processing fee is applied when you confirm your payment method.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
npx tsc --noEmit
```

Expected: no errors relating to `PaymentMethodFeeInfo`

- [ ] **Step 3: Commit**

```bash
git add components/public/PaymentMethodFeeInfo.tsx
git commit -m "feat: add PaymentMethodFeeInfo component for checkout fee transparency"
```

---

## Task 7: Wire Fee Confirmation into Checkout Flow

**Files:**
- Modify: `components/public/StripePaymentSection.tsx`
- Modify: `components/public/CheckoutForm.tsx`

- [ ] **Step 1: Update StripePaymentSection**

Replace the full contents of `components/public/StripePaymentSection.tsx`:

```tsx
'use client'

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useState } from 'react'

interface StripePaymentSectionProps {
  onSuccess: (bookingId: string) => void
  onError: (error: string) => void
  onFeeConfirmed: (processingFee: number) => void
  bookingId: string
  isSubmitting: boolean
  setIsSubmitting: (v: boolean) => void
}

export default function StripePaymentSection({
  onSuccess,
  onError,
  onFeeConfirmed,
  bookingId,
  isSubmitting,
  setIsSubmitting,
}: StripePaymentSectionProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  async function handleConfirm() {
    if (!stripe || !elements) return

    if (!selectedMethod) {
      onError('Please select a payment method.')
      return
    }

    setIsSubmitting(true)

    try {
      const feeRes = await fetch(`/api/bookings/${bookingId}/payment-method`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method_key: selectedMethod }),
      })

      if (!feeRes.ok) {
        const data = await feeRes.json()
        onError(data.error ?? 'Failed to confirm payment method. Please try again.')
        setIsSubmitting(false)
        return
      }

      const { processing_fee } = await feeRes.json()
      onFeeConfirmed(processing_fee)
    } catch {
      onError('Network error. Please check your connection and try again.')
      setIsSubmitting(false)
      return
    }

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (error) {
      onError(error.message ?? 'Payment failed. Please try again.')
      setIsSubmitting(false)
    } else {
      onSuccess(bookingId)
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{ layout: 'tabs' }}
        onChange={(e) => {
          if (e.value?.type) setSelectedMethod(e.value.type)
        }}
      />

      <button
        type="button"
        onClick={handleConfirm}
        disabled={isSubmitting || !stripe || !elements}
        className="w-full bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold shadow-[0_0_10px_rgba(45,212,191,0.30)] transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Processing…' : 'Complete Booking'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Update CheckoutForm**

In `components/public/CheckoutForm.tsx`:

**a) Add `PaymentMethodConfig` to the types import:**

```ts
import { BookingParams, PaymentMethodConfig } from '@/types'
```

**b) Add import for the new component:**

```ts
import PaymentMethodFeeInfo from './PaymentMethodFeeInfo'
```

**c) Add `availablePaymentMethods` state after existing state declarations:**

```ts
const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethodConfig[]>([])
```

**d) In `handleGuestInfoSubmit`, update the success block to also store `available_payment_methods`:**

Find:
```ts
      setClientSecret(data.clientSecret)
      setBookingId(data.bookingId)
      onProcessingFeeSet(data.processing_fee ?? 0)
      setStep('payment')
```

Replace with:
```ts
      setClientSecret(data.clientSecret)
      setBookingId(data.bookingId)
      onProcessingFeeSet(0)
      setAvailablePaymentMethods(data.available_payment_methods ?? [])
      setStep('payment')
```

**e) In the `guest_info` step JSX, add `<PaymentMethodFeeInfo>` just above the Submit button:**

Find the error display block and the submit button near the bottom of the `guest_info` form. Insert `<PaymentMethodFeeInfo>` between the consent checkboxes block and the error display:

```tsx
          <PaymentMethodFeeInfo methods={availablePaymentMethods} />

          {error && (
```

Wait — `availablePaymentMethods` is empty until after booking creation (it's populated from the API response, after the form submits). Since guests see the guest info form before submitting, `availablePaymentMethods` will be empty on first render. We want to show this info while still on the guest_info step.

**Correct approach:** fetch the available methods from the page server side and pass to `CheckoutForm` as a prop. See Task 8 for the page changes. For now, wire the prop:

Add `availablePaymentMethods` to `CheckoutFormProps`:

```ts
interface CheckoutFormProps {
  bookingParams: BookingParams
  onProcessingFeeSet: (fee: number) => void
  availablePaymentMethods: PaymentMethodConfig[]
}
```

Update the component signature:

```ts
export default function CheckoutForm({ bookingParams, onProcessingFeeSet, availablePaymentMethods }: CheckoutFormProps) {
```

Remove the local `availablePaymentMethods` state (it's now a prop). The `setAvailablePaymentMethods` call in step (d) is no longer needed — remove it.

Place `<PaymentMethodFeeInfo>` in the guest info step, inside the form, above the consent checkboxes div:

```tsx
          <PaymentMethodFeeInfo methods={availablePaymentMethods} />

          <div className="space-y-3">
            {/* ... existing consent checkboxes ... */}
```

**f) Update the `<StripePaymentSection>` usage in the payment step to pass `onFeeConfirmed`:**

Find:
```tsx
            <StripePaymentSection
              bookingId={bookingId}
              isSubmitting={isSubmitting}
              setIsSubmitting={setIsSubmitting}
              onSuccess={(id) =>
                router.push(
                  `/booking/confirmation?booking_id=${id}&guest_email=${encodeURIComponent(guestInfo.guest_email)}`,
                )
              }
              onError={setError}
            />
```

Replace with:
```tsx
            <StripePaymentSection
              bookingId={bookingId}
              isSubmitting={isSubmitting}
              setIsSubmitting={setIsSubmitting}
              onFeeConfirmed={onProcessingFeeSet}
              onSuccess={(id) =>
                router.push(
                  `/booking/confirmation?booking_id=${id}&guest_email=${encodeURIComponent(guestInfo.guest_email)}`,
                )
              }
              onError={setError}
            />
```

- [ ] **Step 3: Type-check the changes**

```bash
npx tsc --noEmit
```

Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add components/public/StripePaymentSection.tsx components/public/CheckoutForm.tsx
git commit -m "feat: track selected payment method and PATCH fee before confirmPayment"
```

---

## Task 8: Wire Available Methods into Checkout Page + Update Summary

**Files:**
- Modify: `app/(public)/checkout/page.tsx`
- Modify: `components/public/CheckoutPageInner.tsx`
- Modify: `components/public/CheckoutSummary.tsx`

- [ ] **Step 1: Fetch available methods by booking type in checkout page**

The checkout page doesn't know the booking type until the URL is parsed on the client. Since `available_payment_methods` is needed for display before booking creation, we fetch all configs server-side and let `CheckoutPageInner` pick the right set.

Replace the full contents of `app/(public)/checkout/page.tsx`:

```tsx
import { Suspense } from 'react'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import CheckoutPageInner from '@/components/public/CheckoutPageInner'
import type { PaymentMethodConfig } from '@/types'

export default async function CheckoutPage() {
  let checkinTime = '15:00'
  let checkoutTime = '10:00'
  let shortTermMethods: PaymentMethodConfig[] = []
  let longTermMethods: PaymentMethodConfig[] = []

  try {
    const serverClient = await createServerSupabaseClient()
    const { data: settings } = await serverClient
      .from('site_settings')
      .select('checkin_time, checkout_time')
      .maybeSingle()
    if (settings?.checkin_time) checkinTime = settings.checkin_time
    if (settings?.checkout_time) checkoutTime = settings.checkout_time

    const supabase = createServiceRoleClient()
    const { data: configs } = await supabase
      .from('payment_method_configs')
      .select('id, booking_type, method_key, label, is_enabled, fee_percent, fee_flat, sort_order')
      .eq('is_enabled', true)
      .order('sort_order')

    for (const c of (configs ?? []) as PaymentMethodConfig[]) {
      if (c.booking_type === 'short_term') shortTermMethods.push(c)
      else if (c.booking_type === 'long_term') longTermMethods.push(c)
    }
  } catch {
    // fall through to empty defaults
  }

  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-on-surface-variant">Loading checkout…</p>
        </main>
      }
    >
      <CheckoutPageInner
        checkinTime={checkinTime}
        checkoutTime={checkoutTime}
        shortTermMethods={shortTermMethods}
        longTermMethods={longTermMethods}
      />
    </Suspense>
  )
}
```

- [ ] **Step 2: Update CheckoutPageInner**

Replace the full contents of `components/public/CheckoutPageInner.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CheckoutForm from '@/components/public/CheckoutForm'
import CheckoutSummary from '@/components/public/CheckoutSummary'
import { BookingParams, BookingType, PaymentMethodConfig, RoomFee } from '@/types'

interface CheckoutPageInnerProps {
  checkinTime: string
  checkoutTime: string
  shortTermMethods: PaymentMethodConfig[]
  longTermMethods: PaymentMethodConfig[]
}

export default function CheckoutPageInner({
  checkinTime,
  checkoutTime,
  shortTermMethods,
  longTermMethods,
}: CheckoutPageInnerProps) {
  const searchParams = useSearchParams()

  function getParam(key: string): string {
    return searchParams.get(key) ?? ''
  }

  function getNumParam(key: string): number {
    return Number(searchParams.get(key) ?? '0')
  }

  const bookingType = (getParam('type') as BookingType) || 'short_term'
  const availablePaymentMethods =
    bookingType === 'long_term' ? longTermMethods : shortTermMethods

  const bookingParams: BookingParams = {
    room_id: getParam('room_id'),
    room_slug: getParam('room'),
    booking_type: bookingType,
    check_in: getParam('checkin'),
    check_out: getParam('checkout'),
    guests: getNumParam('guests'),
    nightly_rate: getNumParam('nightly_rate'),
    monthly_rate: getNumParam('monthly_rate'),
    total_nights: getNumParam('total_nights'),
    total_amount: getNumParam('total_amount'),
    amount_to_pay: getNumParam('amount_to_pay'),
    amount_due_at_checkin: getNumParam('amount_due'),
    cleaning_fee: getNumParam('cleaning_fee'),
    security_deposit: getNumParam('security_deposit'),
    extra_guest_fee: getNumParam('extra_guest_fee'),
    fees: (() => {
      try {
        const parsed = JSON.parse(getParam('fees') || '[]')
        if (
          !Array.isArray(parsed) ||
          !parsed.every(
            (f) =>
              typeof f === 'object' &&
              f !== null &&
              typeof f.id === 'string' &&
              typeof f.label === 'string' &&
              typeof f.amount === 'number' &&
              ['short_term', 'long_term', 'both'].includes(f.booking_type),
          )
        ) {
          return []
        }
        return parsed as RoomFee[]
      } catch {
        return []
      }
    })(),
  }

  const roomName = getParam('room_name') || bookingParams.room_slug || 'Your Room'
  const propertyName = getParam('property_name') || 'Top of the Hill Estates'

  const [processingFee, setProcessingFee] = useState(0)

  const paramError = (() => {
    if (!bookingParams.room_id) return 'Missing room information. Please start your booking from the room page.'
    if (bookingType === 'short_term') {
      if (!bookingParams.check_in) return 'Missing check-in date. Please start your booking from the room page.'
      if (!bookingParams.check_out) return 'Missing check-out date. Please start your booking from the room page.'
      if (bookingParams.total_nights < 1) return 'Invalid stay length. Please start your booking from the room page.'
    } else {
      if (!bookingParams.check_in) return 'Missing move-in date. Please start your booking from the room page.'
    }
    if (bookingParams.amount_to_pay <= 0) return 'Invalid booking amount. Please start your booking from the room page.'
    return null
  })()

  if (paramError) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <p className="text-on-surface-variant text-sm">{paramError}</p>
          <a
            href="/rooms"
            className="inline-block bg-gradient-to-r from-primary to-secondary text-background font-semibold px-6 py-3 rounded-2xl hover:opacity-90 transition-opacity"
          >
            Browse Rooms
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl font-bold text-on-surface mb-8">
          Complete Your Booking
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-6 lg:p-8">
            <CheckoutForm
              bookingParams={bookingParams}
              onProcessingFeeSet={setProcessingFee}
              availablePaymentMethods={availablePaymentMethods}
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
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Update CheckoutSummary — add fee-varies note**

In `components/public/CheckoutSummary.tsx`, find the processing fee row and the "Processing fees are non-refundable" note. Add a "varies by method" note when fee is 0:

Find:
```tsx
        {processingFee > 0 && (
          <p className="text-on-surface-variant/60 text-xs mt-2 text-right italic">
            Processing fees are non-refundable.
          </p>
        )}
```

Replace with:
```tsx
        {processingFee > 0 ? (
          <p className="text-on-surface-variant/60 text-xs mt-2 text-right italic">
            Processing fees are non-refundable.
          </p>
        ) : (
          <p className="text-on-surface-variant/60 text-xs mt-2 text-right italic">
            Processing fee varies by payment method.
          </p>
        )}
```

- [ ] **Step 4: Type-check everything**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/(public)/checkout/page.tsx components/public/CheckoutPageInner.tsx components/public/CheckoutSummary.tsx
git commit -m "feat: pass available payment methods to checkout; show fee-varies note in summary"
```

---

## Task 9: Admin Settings — Payment Methods Section

**Files:**
- Modify: `app/admin/(protected)/settings/page.tsx`
- Modify: `components/admin/SettingsForm.tsx`

- [ ] **Step 1: Fetch payment method configs in the settings page**

In `app/admin/(protected)/settings/page.tsx`, replace the full file content:

```tsx
export const dynamic = 'force-dynamic'

import { createServiceRoleClient } from '@/lib/supabase'
import SettingsForm from '@/components/admin/SettingsForm'
import type { PaymentMethodConfig, SiteSettings } from '@/types'

export default async function SettingsAdminPage() {
  const supabase = createServiceRoleClient()

  const [settingsResult, configsResult] = await Promise.all([
    supabase.from('site_settings').select('*').single(),
    supabase
      .from('payment_method_configs')
      .select('*')
      .order('booking_type')
      .order('sort_order'),
  ])

  const fallback: SiteSettings = {
    id: '',
    business_name: 'Top of the Hill Rooms',
    about_text: '',
    contact_phone: '',
    contact_email: '',
    contact_address: '',
    updated_at: '',
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-3xl text-primary mb-8">Settings</h1>
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] p-6 md:p-8">
          <SettingsForm
            settings={settingsResult.data ?? fallback}
            paymentMethodConfigs={(configsResult.data ?? []) as PaymentMethodConfig[]}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `paymentMethodConfigs` prop to SettingsForm**

In `components/admin/SettingsForm.tsx`, update the props interface:

Find:
```ts
interface SettingsFormProps {
  settings: SiteSettings
}
```

Replace with:
```ts
import type { SiteSettings, BusinessHours, PaymentMethodConfig } from '@/types'

interface SettingsFormProps {
  settings: SiteSettings
  paymentMethodConfigs: PaymentMethodConfig[]
}
```

(Also remove `BusinessHours` from any separate import and merge into this one import.)

Update the component signature:
```ts
export default function SettingsForm({ settings, paymentMethodConfigs }: SettingsFormProps) {
```

- [ ] **Step 3: Add payment method config state**

After existing `useState` declarations in `SettingsForm`, add:

```ts
  const [methodConfigs, setMethodConfigs] = useState<PaymentMethodConfig[]>(paymentMethodConfigs)
  const [methodSaving, setMethodSaving] = useState<Record<string, boolean>>({})
  const [methodError, setMethodError] = useState<Record<string, string>>({})
```

- [ ] **Step 4: Add the save handler for individual method configs**

After the `handleLogoUpload` function, add:

```ts
  async function handleMethodConfigChange(
    id: string,
    field: 'is_enabled' | 'fee_percent' | 'fee_flat',
    value: boolean | number,
  ) {
    setMethodConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    )
  }

  async function saveMethodConfig(id: string) {
    const config = methodConfigs.find((c) => c.id === id)
    if (!config) return

    setMethodSaving((prev) => ({ ...prev, [id]: true }))
    setMethodError((prev) => ({ ...prev, [id]: '' }))

    try {
      const res = await fetch(`/api/admin/payment-method-configs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_enabled: config.is_enabled,
          fee_percent: config.fee_percent,
          fee_flat: config.fee_flat,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setMethodError((prev) => ({ ...prev, [id]: json.error ?? 'Save failed' }))
      }
    } catch {
      setMethodError((prev) => ({ ...prev, [id]: 'Network error' }))
    } finally {
      setMethodSaving((prev) => ({ ...prev, [id]: false }))
    }
  }
```

- [ ] **Step 5: Add the Payment Methods section to the JSX**

In the JSX returned by `SettingsForm`, find the closing `</form>` tag. Add the Payment Methods section as a sibling section after the form (still inside the outer component return, not inside the `<form>`):

First, find where the JSX ends and add a helper render function before the return:

```ts
  function renderMethodSection(
    label: string,
    bookingType: 'short_term' | 'long_term',
  ) {
    const methods = methodConfigs.filter((c) => c.booking_type === bookingType)
    return (
      <div>
        <h3 className="font-display text-base font-semibold text-on-surface mb-3">{label}</h3>
        <p className="text-on-surface-variant/60 text-xs mb-4 italic">
          Fee replaces the base processing fee for this payment method.
        </p>
        <div className="space-y-3">
          {methods.map((config) => (
            <div
              key={config.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 bg-surface-container rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.is_enabled}
                  onClick={() => {
                    handleMethodConfigChange(config.id, 'is_enabled', !config.is_enabled)
                    setTimeout(() => saveMethodConfig(config.id), 0)
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    config.is_enabled ? 'bg-primary' : 'bg-outline-variant'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      config.is_enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-on-surface text-sm font-medium truncate">{config.label}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label={`${config.label} fee percent`}
                    value={config.fee_percent}
                    onChange={(e) =>
                      handleMethodConfigChange(config.id, 'fee_percent', Number(e.target.value))
                    }
                    onBlur={() => saveMethodConfig(config.id)}
                    className="w-16 bg-surface-highest/40 rounded-lg px-2 py-1.5 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 text-right"
                  />
                  <span className="text-on-surface-variant text-sm">%</span>
                </div>
                <span className="text-on-surface-variant text-xs">+</span>
                <div className="flex items-center gap-1">
                  <span className="text-on-surface-variant text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label={`${config.label} flat fee`}
                    value={config.fee_flat}
                    onChange={(e) =>
                      handleMethodConfigChange(config.id, 'fee_flat', Number(e.target.value))
                    }
                    onBlur={() => saveMethodConfig(config.id)}
                    className="w-16 bg-surface-highest/40 rounded-lg px-2 py-1.5 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 text-right"
                  />
                </div>
                {methodSaving[config.id] && (
                  <span className="text-secondary text-xs">Saving…</span>
                )}
                {methodError[config.id] && (
                  <span className="text-error text-xs">{methodError[config.id]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
```

Then in the JSX return, after the closing `</form>`, add:

```tsx
      <div className="mt-8 space-y-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-on-surface mb-1">
            Payment Methods
          </h2>
          <p className="text-on-surface-variant text-sm mb-6">
            Configure which payment methods guests can use and the processing fee for each.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderMethodSection('Short-term Bookings', 'short_term')}
          {renderMethodSection('Long-term Bookings', 'long_term')}
        </div>
      </div>
```

- [ ] **Step 6: Type-check everything**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add app/admin/(protected)/settings/page.tsx components/admin/SettingsForm.tsx
git commit -m "feat: add Payment Methods configuration section to admin settings"
```

---

## Self-Review Checklist

- [x] **Spec: payment_method_configs table** → Task 1
- [x] **Spec: PaymentMethodConfig TS type** → Task 1
- [x] **Spec: GET /api/admin/payment-method-configs** → Task 2
- [x] **Spec: PATCH /api/admin/payment-method-configs/[id]** → Task 3
- [x] **Spec: PATCH /api/bookings/[id]/payment-method** → Task 4 (with method-change re-calc in test)
- [x] **Spec: POST /api/bookings queries configs, sets payment_method_types, returns available_payment_methods** → Task 5
- [x] **Spec: 422 when no methods enabled** → Task 5 Step 2
- [x] **Spec: PaymentMethodFeeInfo component** → Task 6
- [x] **Spec: PaymentMethodFeeInfo shown in guest info step** → Task 7
- [x] **Spec: selectedMethod tracked via PaymentElement.onChange** → Task 7
- [x] **Spec: PATCH called before confirmPayment; onFeeConfirmed updates summary** → Task 7
- [x] **Spec: null selectedMethod guard** → Task 7 (in StripePaymentSection handleConfirm)
- [x] **Spec: CheckoutSummary fee-varies note** → Task 8
- [x] **Spec: Admin Payment Methods section with toggle + fee inputs** → Task 9
- [x] **Spec: per-row auto-save on blur** → Task 9
