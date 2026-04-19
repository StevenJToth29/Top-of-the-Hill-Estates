# Stripe Per-Property Payout Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route each property's guest payments to a distinct Stripe connected account (and therefore a distinct bank account) via Stripe Connect Destination Charges, with a configurable per-property platform fee.

**Architecture:** A new `stripe_accounts` table stores connected account IDs; properties get a nullable FK to it plus a `platform_fee_percent` column. When creating a payment intent, the booking route checks whether the property has a connected account and adds `transfer_data.destination` + `application_fee_amount` accordingly — Stripe handles the transfer atomically, no webhook changes needed.

**Tech Stack:** Next.js App Router, Supabase (postgres + service-role client), Stripe Node SDK, React + Tailwind, Jest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/008_stripe_payout_accounts.sql` | DB schema changes |
| Modify | `types/index.ts` | Add `StripeAccount` type, update `Property` |
| Create | `app/api/admin/payout-accounts/route.ts` | GET list + POST create |
| Create | `app/api/admin/payout-accounts/[id]/route.ts` | PATCH update + DELETE |
| Modify | `app/api/admin/properties/route.ts` | Accept payout fields in POST + PATCH |
| Modify | `app/api/bookings/route.ts` | Destination charge logic |
| Modify | `components/admin/AdminSidebar.tsx` | Add Payout Accounts nav item |
| Create | `app/admin/(protected)/payout-accounts/page.tsx` | Admin page (server component) |
| Create | `components/admin/PayoutAccountsTable.tsx` | CRUD table (client component) |
| Modify | `components/admin/PropertyForm.tsx` | Payout account dropdown + fee field |
| Modify | `app/admin/(protected)/properties/[id]/edit/page.tsx` | Fetch + pass stripe_accounts |
| Modify | `app/admin/(protected)/properties/new/page.tsx` | Fetch + pass stripe_accounts |
| Create | `__tests__/api/admin/payout-accounts.test.ts` | API route tests |
| Create | `__tests__/api/bookings-destination-charges.test.ts` | Destination charge tests |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/008_stripe_payout_accounts.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/008_stripe_payout_accounts.sql

create table stripe_accounts (
  id                uuid        primary key default gen_random_uuid(),
  label             text        not null,
  stripe_account_id text        not null unique,
  created_at        timestamptz default now()
);

alter table properties
  add column stripe_account_id    uuid    references stripe_accounts(id) on delete set null,
  add column platform_fee_percent numeric default 0
    check (platform_fee_percent >= 0 and platform_fee_percent <= 100);
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool (or run `supabase db push` locally) to apply the migration. Verify no errors.

- [ ] **Step 3: Verify schema**

Run the following SQL to confirm the table and columns exist:

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'stripe_accounts';

select column_name, data_type
from information_schema.columns
where table_name = 'properties'
  and column_name in ('stripe_account_id', 'platform_fee_percent');
```

Expected: `stripe_accounts` has `id`, `label`, `stripe_account_id`, `created_at`. `properties` has the two new columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/008_stripe_payout_accounts.sql
git commit -m "feat: add stripe_accounts table and payout columns to properties"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add `StripeAccount` interface after `BookingFee`**

In `types/index.ts`, after the `BookingFee` interface (line 129), add:

```typescript
export interface StripeAccount {
  id: string
  label: string
  stripe_account_id: string
  created_at: string
}
```

- [ ] **Step 2: Update `Property` interface**

In `types/index.ts`, update the `Property` interface to add the two new optional fields before `created_at`:

```typescript
export interface Property {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  description: string
  images: string[]
  amenities: string[]
  bedrooms: number
  bathrooms: number
  house_rules?: string
  use_global_house_rules?: boolean
  stripe_account_id?: string | null
  platform_fee_percent?: number
  created_at: string
  // joined
  stripe_account?: StripeAccount | null
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts
git commit -m "feat: add StripeAccount type and payout fields to Property"
```

---

## Task 3: Payout Accounts API — GET + POST

**Files:**
- Create: `app/api/admin/payout-accounts/route.ts`
- Create: `__tests__/api/admin/payout-accounts.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/admin/payout-accounts.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/admin/payout-accounts/route'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

const mockCreateServerClient = createServerSupabaseClient as jest.Mock
const mockCreateServiceClient = createServiceRoleClient as jest.Mock
const authedUser = { id: 'user-1', email: 'admin@test.com' }

function makePostRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/payout-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeAuthMock() {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: authedUser }, error: null }),
    },
  }
}

function makeDbMock(opts: {
  listData?: unknown[]
  listError?: unknown
  insertData?: unknown
  insertError?: unknown
} = {}) {
  const single = jest.fn().mockResolvedValue({ data: opts.insertData ?? null, error: opts.insertError ?? null })
  const selectAfterInsert = jest.fn().mockReturnValue({ single })
  const insert = jest.fn().mockReturnValue({ select: selectAfterInsert })

  const orderResult = jest.fn().mockResolvedValue({ data: opts.listData ?? [], error: opts.listError ?? null })
  const select = jest.fn().mockReturnValue({ order: orderResult })

  const from = jest.fn().mockReturnValue({ select, insert })
  return { from, select, insert, orderResult, single }
}

beforeEach(() => {
  mockCreateServerClient.mockResolvedValue(makeAuthMock())
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('GET /api/admin/payout-accounts', () => {
  test('returns list of accounts', async () => {
    const accounts = [
      { id: 'acc-1', label: 'House A Bank', stripe_account_id: 'acct_aaa', created_at: '2026-01-01' },
    ]
    const db = makeDbMock({ listData: accounts })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await GET()

    expect(db.from).toHaveBeenCalledWith('stripe_accounts')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(accounts)
  })

  test('returns empty array when no accounts', async () => {
    const db = makeDbMock({ listData: [] })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  test('returns 500 on DB error', async () => {
    const db = makeDbMock({ listError: { message: 'db error' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/admin/payout-accounts', () => {
  test('returns 401 when not authenticated', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const res = await POST(makePostRequest({ label: 'Test', stripe_account_id: 'acct_test' }))
    expect(res.status).toBe(401)
  })

  test('returns 400 when label is missing', async () => {
    const db = makeDbMock()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await POST(makePostRequest({ stripe_account_id: 'acct_test' }))
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  test('returns 400 when stripe_account_id is missing', async () => {
    const db = makeDbMock()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await POST(makePostRequest({ label: 'Test Bank' }))
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  test('creates account and returns 201', async () => {
    const created = { id: 'acc-1', label: 'House A Bank', stripe_account_id: 'acct_aaa', created_at: '2026-01-01' }
    const db = makeDbMock({ insertData: created })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await POST(makePostRequest({ label: 'House A Bank', stripe_account_id: 'acct_aaa' }))

    expect(db.insert).toHaveBeenCalledWith({ label: 'House A Bank', stripe_account_id: 'acct_aaa' })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(created)
  })

  test('returns 500 on DB error', async () => {
    const db = makeDbMock({ insertError: { message: 'duplicate key' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await POST(makePostRequest({ label: 'Test', stripe_account_id: 'acct_dup' }))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/api/admin/payout-accounts.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `app/api/admin/payout-accounts/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('stripe_accounts')
    .select('*')
    .order('label')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const label = body.label?.trim()
  const stripe_account_id = body.stripe_account_id?.trim()

  if (!label || !stripe_account_id) {
    return NextResponse.json({ error: 'label and stripe_account_id are required' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('stripe_accounts')
    .insert({ label, stripe_account_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/api/admin/payout-accounts.test.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/payout-accounts/route.ts __tests__/api/admin/payout-accounts.test.ts
git commit -m "feat: add payout accounts API — GET and POST"
```

---

## Task 4: Payout Accounts API — PATCH + DELETE

**Files:**
- Create: `app/api/admin/payout-accounts/[id]/route.ts`
- Modify: `__tests__/api/admin/payout-accounts.test.ts`

- [ ] **Step 1: Add PATCH and DELETE tests**

Append to `__tests__/api/admin/payout-accounts.test.ts`:

```typescript
import { PATCH, DELETE } from '@/app/api/admin/payout-accounts/[id]/route'

function makePatchRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/payout-accounts/acc-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest() {
  return new Request('http://localhost/api/admin/payout-accounts/acc-1', { method: 'DELETE' })
}

function makePatchDbMock(opts: { updateData?: unknown; updateError?: unknown } = {}) {
  const single = jest.fn().mockResolvedValue({ data: opts.updateData ?? null, error: opts.updateError ?? null })
  const selectAfterUpdate = jest.fn().mockReturnValue({ single })
  const eq = jest.fn().mockReturnValue({ select: selectAfterUpdate })
  const update = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ update })
  return { from, update, eq, single }
}

function makeDeleteDbMock(opts: { propertyCount?: number; deleteError?: unknown } = {}) {
  const head = jest.fn().mockResolvedValue({ count: opts.propertyCount ?? 0, error: null })
  const propertiesSelect = jest.fn().mockReturnValue({ head })
  const propertiesEq = jest.fn().mockReturnValue({ select: propertiesSelect })

  const deleteResult = jest.fn().mockResolvedValue({ error: opts.deleteError ?? null })
  const accountsEq = jest.fn().mockReturnValue(deleteResult)
  const deleteFn = jest.fn().mockReturnValue({ eq: accountsEq })

  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'properties') return { select: jest.fn().mockReturnValue({ eq: propertiesEq }) }
    return { delete: deleteFn }
  })
  return { from, propertiesEq, deleteFn, accountsEq }
}

describe('PATCH /api/admin/payout-accounts/[id]', () => {
  test('returns 401 when not authenticated', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const res = await PATCH(makePatchRequest({ label: 'New Label' }), { params: { id: 'acc-1' } })
    expect(res.status).toBe(401)
  })

  test('updates label and returns updated record', async () => {
    const updated = { id: 'acc-1', label: 'Updated Label', stripe_account_id: 'acct_aaa', created_at: '2026-01-01' }
    const db = makePatchDbMock({ updateData: updated })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makePatchRequest({ label: 'Updated Label' }), { params: { id: 'acc-1' } })

    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ label: 'Updated Label' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(updated)
  })

  test('returns 500 on DB error', async () => {
    const db = makePatchDbMock({ updateError: { message: 'update failed' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makePatchRequest({ label: 'X' }), { params: { id: 'acc-1' } })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/admin/payout-accounts/[id]', () => {
  test('returns 401 when not authenticated', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const res = await DELETE(makeDeleteRequest(), { params: { id: 'acc-1' } })
    expect(res.status).toBe(401)
  })

  test('returns 409 when properties reference this account', async () => {
    const db = makeDeleteDbMock({ propertyCount: 2 })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await DELETE(makeDeleteRequest(), { params: { id: 'acc-1' } })
    expect(res.status).toBe(409)
  })

  test('deletes account when no properties reference it', async () => {
    const db = makeDeleteDbMock({ propertyCount: 0 })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await DELETE(makeDeleteRequest(), { params: { id: 'acc-1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  test('returns 500 on DB error during delete', async () => {
    const db = makeDeleteDbMock({ deleteError: { message: 'delete failed' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await DELETE(makeDeleteRequest(), { params: { id: 'acc-1' } })
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/api/admin/payout-accounts.test.ts --no-coverage
```

Expected: FAIL — `[id]/route` module not found.

- [ ] **Step 3: Implement the route**

Create `app/api/admin/payout-accounts/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'

interface RouteContext {
  params: { id: string }
}

async function requireAuth() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error } = await serverClient.auth.getUser()
  return error || !user ? null : user
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const fields: Record<string, string> = {}
  if (body.label !== undefined) fields.label = body.label.trim()
  if (body.stripe_account_id !== undefined) fields.stripe_account_id = body.stripe_account_id.trim()

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('stripe_accounts')
    .update(fields)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceRoleClient()

  const { count } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('stripe_account_id', params.id)

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'Remove this payout account from all properties before deleting it.' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('stripe_accounts').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run all payout account tests**

```bash
npx jest __tests__/api/admin/payout-accounts.test.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/payout-accounts/[id]/route.ts __tests__/api/admin/payout-accounts.test.ts
git commit -m "feat: add payout accounts API — PATCH and DELETE"
```

---

## Task 5: Properties API — Accept Payout Fields

**Files:**
- Modify: `app/api/admin/properties/route.ts`

- [ ] **Step 1: Update POST handler**

In `app/api/admin/properties/route.ts`, update the `POST` insert object to include the new fields:

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('properties')
      .insert({
        name: body.name,
        address: body.address,
        city: body.city,
        state: body.state,
        zip: body.zip ?? '',
        description: body.description ?? '',
        bedrooms: Number(body.bedrooms ?? 0),
        bathrooms: Number(body.bathrooms ?? 0),
        amenities: body.amenities ?? [],
        house_rules: body.house_rules ?? '',
        use_global_house_rules: body.use_global_house_rules ?? true,
        images: body.images ?? [],
        stripe_account_id: body.stripe_account_id ?? null,
        platform_fee_percent: Number(body.platform_fee_percent ?? 0),
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Update PATCH handler**

In the same file, update the `PATCH` update object:

```typescript
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('properties')
      .update({
        name: fields.name,
        address: fields.address,
        city: fields.city,
        state: fields.state,
        zip: fields.zip ?? '',
        description: fields.description ?? '',
        bedrooms: Number(fields.bedrooms ?? 0),
        bathrooms: Number(fields.bathrooms ?? 0),
        amenities: fields.amenities ?? [],
        house_rules: fields.house_rules ?? '',
        use_global_house_rules: fields.use_global_house_rules ?? true,
        images: fields.images ?? [],
        stripe_account_id: fields.stripe_account_id ?? null,
        platform_fee_percent: Number(fields.platform_fee_percent ?? 0),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/properties/route.ts
git commit -m "feat: properties API accepts stripe_account_id and platform_fee_percent"
```

---

## Task 6: Booking Route — Destination Charges

**Files:**
- Modify: `app/api/bookings/route.ts`
- Create: `__tests__/api/bookings-destination-charges.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/bookings-destination-charges.test.ts`:

```typescript
/**
 * @jest-environment node
 *
 * Focused tests for the destination-charge logic added in Task 6.
 * Only the payment intent creation behavior is verified here.
 */
import { POST } from '@/app/api/bookings/route'
import { createServiceRoleClient } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/availability'
import { syncToGHL } from '@/lib/ghl'

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))
jest.mock('@/lib/availability', () => ({ isRoomAvailable: jest.fn() }))
jest.mock('@/lib/ghl', () => ({ syncToGHL: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: jest.fn() } },
}))

import { stripe } from '@/lib/stripe'
const mockStripe = stripe as jest.Mocked<typeof stripe>
const mockCreateServiceClient = createServiceRoleClient as jest.Mock
const mockIsRoomAvailable = isRoomAvailable as jest.Mock

function makeBookingRequest(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room_id: 'room-1',
      booking_type: 'short_term',
      guest_first_name: 'Jane',
      guest_last_name: 'Doe',
      guest_email: 'jane@example.com',
      guest_phone: '555-1234',
      check_in: '2026-05-01',
      check_out: '2026-05-05',
      total_nights: 4,
      guest_count: 1,
      sms_consent: false,
      marketing_consent: false,
      ...overrides,
    }),
  })
}

function makeDbMock(opts: {
  stripeAccountId?: string | null
  platformFeePercent?: number
} = {}) {
  const roomData = {
    nightly_rate: 100,
    monthly_rate: 2000,
    cleaning_fee: 50,
    security_deposit: 0,
    extra_guest_fee: 0,
    property: {
      platform_fee_percent: opts.platformFeePercent ?? 0,
      stripe_account: opts.stripeAccountId
        ? { stripe_account_id: opts.stripeAccountId }
        : null,
    },
  }

  const settingsData = { stripe_fee_percent: 2.9, stripe_fee_flat: 0.30 }
  const bookingData = { id: 'booking-1' }

  const single = jest.fn()
    .mockResolvedValueOnce({ data: roomData, error: null })   // room lookup
    .mockResolvedValueOnce({ data: settingsData, error: null }) // site settings
    .mockResolvedValueOnce({ data: bookingData, error: null }) // booking insert

  const limit = jest.fn().mockReturnValue({ single })
  const eqActive = jest.fn().mockReturnValue({ single })
  const eq = jest.fn().mockReturnValue({ single })
  const select = jest.fn().mockReturnValue({ eq: eqActive, limit, single })
  const insertSelect = jest.fn().mockReturnValue({ single })
  const insert = jest.fn().mockReturnValue({ select: insertSelect })

  const from = jest.fn().mockReturnValue({ select, insert })
  return { from }
}

beforeEach(() => {
  mockIsRoomAvailable.mockResolvedValue(true)
  ;(mockStripe.paymentIntents.create as jest.Mock).mockResolvedValue({
    id: 'pi_test',
    client_secret: 'pi_test_secret',
  })
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('POST /api/bookings — destination charge routing', () => {
  test('includes transfer_data and application_fee_amount when property has a connected account', async () => {
    const db = makeDbMock({ stripeAccountId: 'acct_aaa', platformFeePercent: 20 })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await POST(makeBookingRequest())

    const createCall = (mockStripe.paymentIntents.create as jest.Mock).mock.calls[0][0]
    expect(createCall.transfer_data).toEqual({ destination: 'acct_aaa' })
    expect(createCall.application_fee_amount).toBeGreaterThan(0)
  })

  test('application_fee_amount is 0 when platform_fee_percent is 0', async () => {
    const db = makeDbMock({ stripeAccountId: 'acct_aaa', platformFeePercent: 0 })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await POST(makeBookingRequest())

    const createCall = (mockStripe.paymentIntents.create as jest.Mock).mock.calls[0][0]
    expect(createCall.transfer_data).toEqual({ destination: 'acct_aaa' })
    expect(createCall.application_fee_amount).toBe(0)
  })

  test('omits transfer_data and application_fee_amount when property has no connected account', async () => {
    const db = makeDbMock({ stripeAccountId: null })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await POST(makeBookingRequest())

    const createCall = (mockStripe.paymentIntents.create as jest.Mock).mock.calls[0][0]
    expect(createCall.transfer_data).toBeUndefined()
    expect(createCall.application_fee_amount).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/api/bookings-destination-charges.test.ts --no-coverage
```

Expected: FAIL — behavior not yet implemented.

- [ ] **Step 3: Update the room query in the booking route**

In `app/api/bookings/route.ts`, replace the room select on line 50:

Old:
```typescript
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('nightly_rate, monthly_rate, cleaning_fee, security_deposit, extra_guest_fee')
      .eq('id', room_id)
      .eq('is_active', true)
      .single()
```

New:
```typescript
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('nightly_rate, monthly_rate, cleaning_fee, security_deposit, extra_guest_fee, property:properties(platform_fee_percent, stripe_account:stripe_accounts(stripe_account_id))')
      .eq('id', room_id)
      .eq('is_active', true)
      .single()
```

- [ ] **Step 4: Replace the payment intent creation block**

In `app/api/bookings/route.ts`, replace lines 123–127:

Old:
```typescript
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount_to_pay * 100),
      currency: 'usd',
      metadata: { room_id, booking_type, guest_email },
    })
```

New:
```typescript
    const roomWithProperty = room as typeof room & {
      property?: {
        platform_fee_percent?: number
        stripe_account?: { stripe_account_id?: string } | null
      }
    }
    const connectedAccountId = roomWithProperty?.property?.stripe_account?.stripe_account_id
    const platformFeePercent = Number(roomWithProperty?.property?.platform_fee_percent ?? 0)

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

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest __tests__/api/bookings-destination-charges.test.ts --no-coverage
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/bookings/route.ts __tests__/api/bookings-destination-charges.test.ts
git commit -m "feat: route payments to connected account via Stripe destination charges"
```

---

## Task 7: Admin Sidebar — Add Payout Accounts Nav Item

**Files:**
- Modify: `components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Add the nav item**

In `components/admin/AdminSidebar.tsx`, add `BanknotesIcon` to the Heroicons import and add a new entry to `NAV_ITEMS`.

Replace the import line:
```typescript
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  HomeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
```

With:
```typescript
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  Bars3Icon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  HomeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
```

Replace the `NAV_ITEMS` array:
```typescript
export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: ChartBarIcon },
  { label: 'Properties', href: '/admin/properties', icon: BuildingOfficeIcon },
  { label: 'Rooms', href: '/admin/rooms', icon: HomeIcon },
  { label: 'Bookings', href: '/admin/bookings', icon: CalendarIcon },
  { label: 'Calendar', href: '/admin/calendar', icon: CalendarDaysIcon },
  { label: 'iCal Sync', href: '/admin/ical', icon: ArrowPathIcon },
  { label: 'Payout Accounts', href: '/admin/payout-accounts', icon: BanknotesIcon },
  { label: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon },
]
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/AdminSidebar.tsx
git commit -m "feat: add Payout Accounts to admin sidebar nav"
```

---

## Task 8: Payout Accounts Admin Page

**Files:**
- Create: `app/admin/(protected)/payout-accounts/page.tsx`
- Create: `components/admin/PayoutAccountsTable.tsx`

- [ ] **Step 1: Create the table component**

Create `components/admin/PayoutAccountsTable.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { StripeAccount } from '@/types'

interface PayoutAccountsTableProps {
  accounts: StripeAccount[]
}

const inputClass =
  'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50'
const labelClass = 'block text-sm font-medium text-on-surface-variant mb-1.5'

export default function PayoutAccountsTable({ accounts: initial }: PayoutAccountsTableProps) {
  const [accounts, setAccounts] = useState<StripeAccount[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [stripeAccountId, setStripeAccountId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openAdd() {
    setEditingId(null)
    setLabel('')
    setStripeAccountId('')
    setError(null)
    setShowForm(true)
  }

  function openEdit(account: StripeAccount) {
    setEditingId(account.id)
    setLabel(account.label)
    setStripeAccountId(account.stripe_account_id)
    setError(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        const url = editingId
          ? `/api/admin/payout-accounts/${editingId}`
          : '/api/admin/payout-accounts'
        const method = editingId ? 'PATCH' : 'POST'

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, stripe_account_id: stripeAccountId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Save failed')

        if (editingId) {
          setAccounts((prev) => prev.map((a) => (a.id === editingId ? data : a)))
        } else {
          setAccounts((prev) => [...prev, data])
        }
        cancelForm()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  function handleDelete(account: StripeAccount) {
    if (!confirm(`Delete "${account.label}"? This cannot be undone.`)) return
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/payout-accounts/${account.id}`, { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Delete failed')
        setAccounts((prev) => prev.filter((a) => a.id !== account.id))
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={openAdd}
          className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-6 py-2.5 hover:opacity-90 transition-opacity text-sm"
        >
          + Add Account
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-on-surface">
            {editingId ? 'Edit Payout Account' : 'Add Payout Account'}
          </h3>
          <div>
            <label className={labelClass}>Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. House A Bank"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Stripe Account ID</label>
            <input
              type="text"
              value={stripeAccountId}
              onChange={(e) => setStripeAccountId(e.target.value)}
              placeholder="acct_xxxxxxxxxxxxx"
              className={inputClass}
            />
            <p className="text-xs text-on-surface-variant/60 mt-1.5">
              Copy this from your Stripe Dashboard under Connect → Accounts.
            </p>
          </div>
          {error && (
            <p className="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3">{error}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={cancelForm}
              className="px-5 py-2 rounded-xl text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !label.trim() || !stripeAccountId.trim()}
              className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-xl px-6 py-2 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-8 text-center text-on-surface-variant">
          No payout accounts yet. Add one to start routing property payments.
        </div>
      ) : (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant">
                <th className="text-left px-6 py-3 font-medium">Label</th>
                <th className="text-left px-6 py-3 font-medium">Stripe Account ID</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-outline-variant/50 last:border-0">
                  <td className="px-6 py-4 text-on-surface font-medium">{account.label}</td>
                  <td className="px-6 py-4 text-on-surface-variant font-mono text-xs">
                    {account.stripe_account_id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => openEdit(account)}
                        className="text-xs text-secondary hover:text-secondary/80 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(account)}
                        className="text-xs text-error hover:text-error/80 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the page**

Create `app/admin/(protected)/payout-accounts/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import PayoutAccountsTable from '@/components/admin/PayoutAccountsTable'
import type { StripeAccount } from '@/types'

export default async function PayoutAccountsPage() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const { data: accounts } = await supabase
    .from('stripe_accounts')
    .select('*')
    .order('label')

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">Payout Accounts</h1>
          <p className="text-on-surface-variant mt-1">
            Stripe connected accounts for per-property payout routing. Set these up in your Stripe dashboard first, then paste the account ID here.
          </p>
        </div>
        <PayoutAccountsTable accounts={(accounts ?? []) as StripeAccount[]} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/admin/(protected)/payout-accounts/page.tsx components/admin/PayoutAccountsTable.tsx
git commit -m "feat: add Payout Accounts admin page and table component"
```

---

## Task 9: Property Form — Add Payout Account Fields

**Files:**
- Modify: `components/admin/PropertyForm.tsx`
- Modify: `app/admin/(protected)/properties/[id]/edit/page.tsx`
- Modify: `app/admin/(protected)/properties/new/page.tsx`

- [ ] **Step 1: Update the PropertyForm component**

In `components/admin/PropertyForm.tsx`, make the following changes:

**Update the import line** to add `StripeAccount`:
```typescript
import type { Property, StripeAccount } from '@/types'
```

**Update the `PropertyFormProps` interface**:
```typescript
interface PropertyFormProps {
  property?: Property
  propertyId?: string
  globalHouseRules?: string
  stripeAccounts?: StripeAccount[]
}
```

**Update the function signature**:
```typescript
export default function PropertyForm({ property, propertyId, globalHouseRules = '', stripeAccounts = [] }: PropertyFormProps) {
```

**Add two new state variables** after the existing `const [images, ...]` line:
```typescript
  const [stripeAccountId, setStripeAccountId] = useState<string>(property?.stripe_account_id ?? '')
  const [platformFeePercent, setPlatformFeePercent] = useState<number>(property?.platform_fee_percent ?? 0)
```

**Update the payload in `handleSubmit`** to include the new fields:
```typescript
    const payload = {
      id: propertyId,
      name,
      address,
      city,
      state,
      zip,
      description,
      bedrooms,
      bathrooms,
      amenities,
      house_rules: houseRules,
      use_global_house_rules: useGlobalRules,
      images,
      stripe_account_id: stripeAccountId || null,
      platform_fee_percent: platformFeePercent,
    }
```

**Add a new Payout section** before the closing `{error && ...}` block (after the Images section):
```tsx
      {/* Payout Routing */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-on-surface">Payout Routing</h2>
          <p className="text-xs text-on-surface-variant/60 mt-1">
            Select which Stripe connected account receives payments for this property.
            Manage accounts under{' '}
            <a href="/admin/payout-accounts" className="text-secondary underline">Payout Accounts</a>.
          </p>
        </div>

        <div>
          <label className={labelClass}>Payout Account</label>
          <select
            value={stripeAccountId}
            onChange={(e) => setStripeAccountId(e.target.value)}
            className={inputClass}
          >
            <option value="">None — funds stay in main Stripe account</option>
            {stripeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label} ({account.stripe_account_id})
              </option>
            ))}
          </select>
        </div>

        {stripeAccountId && (
          <div>
            <label className={labelClass}>Platform Fee %</label>
            <input
              type="number"
              value={platformFeePercent}
              onChange={(e) => setPlatformFeePercent(Number(e.target.value))}
              min={0}
              max={100}
              step={0.1}
              placeholder="0"
              className={inputClass}
            />
            <p className="text-xs text-on-surface-variant/60 mt-1.5">
              Your cut before the remainder transfers to the selected account. Set to 0 for your own properties.
            </p>
          </div>
        )}
      </section>
```

- [ ] **Step 2: Update the Edit Property page**

In `app/admin/(protected)/properties/[id]/edit/page.tsx`, update the data fetch and prop passing:

Replace the existing `Promise.all` and page content:

```typescript
export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const serverClient = await createServerSupabaseClient()
  const {
    data: { user },
  } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const [{ data: property }, { data: settings }, { data: stripeAccounts }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', params.id).single(),
    supabase.from('site_settings').select('global_house_rules').maybeSingle(),
    supabase.from('stripe_accounts').select('*').order('label'),
  ])

  if (!property) notFound()
  const globalHouseRules = settings?.global_house_rules ?? ''

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/properties"
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Properties
          </Link>
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">Edit Property</h1>
          <p className="text-on-surface-variant mt-1">{property.name}</p>
        </div>

        <PropertyForm
          property={property as Property}
          propertyId={params.id}
          globalHouseRules={globalHouseRules}
          stripeAccounts={stripeAccounts ?? []}
        />
      </div>
    </div>
  )
}
```

Also add `StripeAccount` to the import:
```typescript
import type { Property, StripeAccount } from '@/types'
```

- [ ] **Step 3: Update the New Property page**

Read `app/admin/(protected)/properties/new/page.tsx` first, then add the stripe_accounts fetch and pass it to PropertyForm. The file currently renders `<PropertyForm />` with minimal props — add:

```typescript
// add this import
import type { StripeAccount } from '@/types'

// inside the page function, after the auth check:
const supabase = createServiceRoleClient()
const { data: stripeAccounts } = await supabase
  .from('stripe_accounts')
  .select('*')
  .order('label')

// pass to PropertyForm:
<PropertyForm stripeAccounts={stripeAccounts ?? []} />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/admin/PropertyForm.tsx \
        app/admin/(protected)/properties/[id]/edit/page.tsx \
        app/admin/(protected)/properties/new/page.tsx
git commit -m "feat: property form — payout account dropdown and platform fee field"
```

---

## Stripe Dashboard Setup (prerequisite — do this before testing end-to-end)

Before testing in a browser, you must create at least one Custom connected account in Stripe:

1. Go to **Stripe Dashboard → Connect → Accounts → + Create**
2. Choose **Custom** account type, fill in required info, link a bank account
3. Copy the resulting **Account ID** (`acct_xxx`)
4. In the admin portal at `/admin/payout-accounts`, add a new entry with that account ID
5. Edit a property at `/admin/properties/[id]/edit` and select the new payout account
6. Make a test booking for that property — verify the payment intent in the Stripe dashboard shows a transfer to the connected account

---

## Self-Review Checklist

- [x] DB migration creates `stripe_accounts` table and adds columns to `properties`
- [x] `StripeAccount` type defined and `Property` type updated
- [x] GET/POST/PATCH/DELETE for `/api/admin/payout-accounts` implemented with auth
- [x] Properties API accepts and persists payout fields
- [x] Booking route fetches connected account via room→property join and applies destination charge
- [x] Zero-fee case (`platform_fee_percent = 0`) still includes `transfer_data` with `application_fee_amount: 0` when account is assigned
- [x] Null connected account case omits both fields — existing behavior unchanged
- [x] Admin sidebar includes Payout Accounts link
- [x] Admin page lists and manages connected accounts
- [x] Property form has dropdown and conditional platform fee field
- [x] Edit and New property pages pass `stripeAccounts` to form
