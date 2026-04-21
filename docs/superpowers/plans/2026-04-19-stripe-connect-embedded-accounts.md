# Stripe Connect Embedded Account Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual Stripe account ID entry with API-created connected accounts and embedded onboarding/management components in the admin payout accounts UI.

**Architecture:** When admin creates a payout account (label only), the server creates a Stripe Express account via API and stores the generated `acct_xxx` ID in the DB. A detail page renders either `ConnectAccountOnboarding` (pre-KYC) or `ConnectAccountManagement` (post-KYC) based on whether `details_submitted` is true on the Stripe account. A new `/api/admin/stripe/account-session` endpoint generates short-lived client secrets for the embedded components.

**Tech Stack:** Next.js 14 App Router, Stripe SDK v17 (existing), `@stripe/connect-js`, `@stripe/react-stripe-connect-js`, Jest (existing)

---

## File Map

**New:**
- `app/api/admin/stripe/account-session/route.ts` — POST: auth-guarded, looks up account by DB UUID, creates Stripe AccountSession, returns `client_secret`
- `app/admin/(protected)/payout-accounts/[id]/page.tsx` — server component: loads account from DB, retrieves Stripe status, renders `StripeConnectPanel`
- `components/admin/StripeConnectPanel.tsx` — client component: initializes Connect JS with `fetchClientSecret`, renders onboarding or management based on `detailsSubmitted` prop
- `__tests__/api/admin/stripe-account-session.test.ts` — tests for the new account-session endpoint

**Modified:**
- `app/api/admin/payout-accounts/route.ts` — POST now creates Stripe account via API; no longer accepts `stripe_account_id` in body
- `app/api/admin/payout-accounts/[id]/route.ts` — PATCH removes `stripe_account_id` from updatable fields
- `components/admin/PayoutAccountsTable.tsx` — add form is label-only; rows show "Manage" link to detail page; edit form is label-only
- `__tests__/api/admin/payout-accounts.test.ts` — update POST tests: mock `stripe.accounts.create`, remove `stripe_account_id` body requirement; add PATCH test for immutable field

---

## Task 1: Install packages and create the account-session endpoint

**Files:**
- Modify: `package.json` (via npm install)
- Create: `app/api/admin/stripe/account-session/route.ts`
- Create: `__tests__/api/admin/stripe-account-session.test.ts`

- [ ] **Step 1: Install Connect JS packages**

```bash
npm install @stripe/connect-js @stripe/react-stripe-connect-js
```

Expected: packages added to `node_modules` and `package.json`

- [ ] **Step 2: Write failing tests**

Create `__tests__/api/admin/stripe-account-session.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { POST } from '@/app/api/admin/stripe/account-session/route'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

jest.mock('@/lib/stripe', () => ({
  stripe: {
    accountSessions: { create: jest.fn() },
  },
}))

const mockCreateServerClient = createServerSupabaseClient as jest.Mock
const mockCreateServiceClient = createServiceRoleClient as jest.Mock
const mockAccountSessions = stripe.accountSessions.create as jest.Mock
const authedUser = { id: 'user-1', email: 'admin@test.com' }

function makePostRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/stripe/account-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockCreateServerClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: authedUser }, error: null }) },
  })
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('POST /api/admin/stripe/account-session', () => {
  test('returns 401 when not authenticated', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const res = await POST(makePostRequest({ account_id: 'acc-uuid-1' }))
    expect(res.status).toBe(401)
  })

  test('returns 400 when account_id is missing', async () => {
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
  })

  test('returns 404 when account not found in DB', async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const eq = jest.fn().mockReturnValue({ single })
    const select = jest.fn().mockReturnValue({ eq })
    const from = jest.fn().mockReturnValue({ select })
    mockCreateServiceClient.mockReturnValue({ from })

    const res = await POST(makePostRequest({ account_id: 'acc-uuid-1' }))
    expect(res.status).toBe(404)
  })

  test('returns client_secret on success', async () => {
    const dbAccount = { id: 'acc-uuid-1', stripe_account_id: 'acct_test123', label: 'Test', created_at: '2026-01-01' }
    const single = jest.fn().mockResolvedValue({ data: dbAccount, error: null })
    const eq = jest.fn().mockReturnValue({ single })
    const select = jest.fn().mockReturnValue({ eq })
    const from = jest.fn().mockReturnValue({ select })
    mockCreateServiceClient.mockReturnValue({ from })

    mockAccountSessions.mockResolvedValue({ client_secret: 'acss_live_xxx' })

    const res = await POST(makePostRequest({ account_id: 'acc-uuid-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.client_secret).toBe('acss_live_xxx')
    expect(mockAccountSessions).toHaveBeenCalledWith({
      account: 'acct_test123',
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
      },
    })
  })

  test('returns 500 when Stripe call fails', async () => {
    const dbAccount = { id: 'acc-uuid-1', stripe_account_id: 'acct_test123', label: 'Test', created_at: '2026-01-01' }
    const single = jest.fn().mockResolvedValue({ data: dbAccount, error: null })
    const eq = jest.fn().mockReturnValue({ single })
    const select = jest.fn().mockReturnValue({ eq })
    const from = jest.fn().mockReturnValue({ select })
    mockCreateServiceClient.mockReturnValue({ from })

    mockAccountSessions.mockRejectedValue(new Error('Stripe error'))

    const res = await POST(makePostRequest({ account_id: 'acc-uuid-1' }))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx jest __tests__/api/admin/stripe-account-session.test.ts -v
```

Expected: FAIL — module `@/app/api/admin/stripe/account-session/route` not found

- [ ] **Step 4: Create the endpoint**

Create `app/api/admin/stripe/account-session/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const account_id = body.account_id?.trim()
  if (!account_id) return NextResponse.json({ error: 'account_id is required' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const { data: account, error: dbError } = await supabase
    .from('stripe_accounts')
    .select('stripe_account_id')
    .eq('id', account_id)
    .single()

  if (dbError || !account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  try {
    const session = await stripe.accountSessions.create({
      account: account.stripe_account_id,
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
      },
    })
    return NextResponse.json({ client_secret: session.client_secret })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/api/admin/stripe-account-session.test.ts -v
```

Expected: PASS — all 5 tests green

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/stripe/account-session/route.ts __tests__/api/admin/stripe-account-session.test.ts package.json package-lock.json
git commit -m "feat: add account-session endpoint for Stripe Connect embedded components"
```

---

## Task 2: Modify POST /api/admin/payout-accounts to auto-create Stripe account

**Files:**
- Modify: `app/api/admin/payout-accounts/route.ts`
- Modify: `__tests__/api/admin/payout-accounts.test.ts`

- [ ] **Step 1: Add the Stripe mock and update POST tests**

In `__tests__/api/admin/payout-accounts.test.ts`, add at the top (after existing imports):

```typescript
import { stripe } from '@/lib/stripe'

jest.mock('@/lib/stripe', () => ({
  stripe: {
    accounts: { create: jest.fn() },
  },
}))

const mockStripeAccountsCreate = stripe.accounts.create as jest.Mock
```

Replace the entire `describe('POST /api/admin/payout-accounts', ...)` block with:

```typescript
describe('POST /api/admin/payout-accounts', () => {
  beforeEach(() => {
    mockStripeAccountsCreate.mockResolvedValue({ id: 'acct_generated123' })
  })

  test('returns 401 when not authenticated', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const res = await POST(makePostRequest({ label: 'Test' }))
    expect(res.status).toBe(401)
  })

  test('returns 400 when label is missing', async () => {
    const db = makeDbMock()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
    expect(mockStripeAccountsCreate).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  test('creates Stripe Express account and inserts to DB', async () => {
    const created = { id: 'acc-uuid-1', label: 'House A Bank', stripe_account_id: 'acct_generated123', created_at: '2026-01-01' }
    const db = makeDbMock({ insertData: created })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await POST(makePostRequest({ label: 'House A Bank' }))

    expect(mockStripeAccountsCreate).toHaveBeenCalledWith({ type: 'express' })
    expect(db.insert).toHaveBeenCalledWith({ label: 'House A Bank', stripe_account_id: 'acct_generated123' })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(created)
  })

  test('returns 500 when Stripe account creation fails', async () => {
    mockStripeAccountsCreate.mockRejectedValue(new Error('Stripe error'))

    const res = await POST(makePostRequest({ label: 'House A Bank' }))
    expect(res.status).toBe(500)
  })

  test('returns 500 on DB error', async () => {
    const db = makeDbMock({ insertError: { message: 'duplicate key' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await POST(makePostRequest({ label: 'Test' }))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run updated POST tests to verify they fail**

```bash
npx jest __tests__/api/admin/payout-accounts.test.ts -v -t "POST"
```

Expected: FAIL — current implementation requires `stripe_account_id` in body and doesn't call Stripe

- [ ] **Step 3: Update the POST route**

Replace the full contents of `app/api/admin/payout-accounts/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

export async function GET() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  if (!label) return NextResponse.json({ error: 'label is required' }, { status: 400 })

  try {
    const stripeAccount = await stripe.accounts.create({ type: 'express' })

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('stripe_accounts')
      .insert({ label, stripe_account_id: stripeAccount.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run all payout-accounts tests**

```bash
npx jest __tests__/api/admin/payout-accounts.test.ts -v
```

Expected: PASS — all tests green (GET, POST, PATCH, DELETE)

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/payout-accounts/route.ts __tests__/api/admin/payout-accounts.test.ts
git commit -m "feat: auto-create Stripe Express account on payout account creation"
```

---

## Task 3: Remove stripe_account_id from PATCH, update PayoutAccountsTable

**Files:**
- Modify: `app/api/admin/payout-accounts/[id]/route.ts`
- Modify: `components/admin/PayoutAccountsTable.tsx`
- Modify: `__tests__/api/admin/payout-accounts.test.ts`

- [ ] **Step 1: Add PATCH test for immutable stripe_account_id**

In `__tests__/api/admin/payout-accounts.test.ts`, inside `describe('PATCH /api/admin/payout-accounts/[id]', ...)`, add:

```typescript
test('does not update stripe_account_id even if provided', async () => {
  const updated = { id: 'acc-1', label: 'Updated Label', stripe_account_id: 'acct_aaa', created_at: '2026-01-01' }
  const db = makePatchDbMock({ updateData: updated })
  mockCreateServiceClient.mockReturnValue({ from: db.from })

  await PATCH(makePatchRequest({ label: 'Updated Label', stripe_account_id: 'acct_injected' }), { params: { id: 'acc-1' } })

  expect(db.update).toHaveBeenCalledWith({ label: 'Updated Label' })
  expect(db.update).not.toHaveBeenCalledWith(expect.objectContaining({ stripe_account_id: expect.anything() }))
})
```

- [ ] **Step 2: Run new test to verify it fails**

```bash
npx jest __tests__/api/admin/payout-accounts.test.ts -v -t "does not update stripe_account_id"
```

Expected: FAIL — current code allows `stripe_account_id` through PATCH

- [ ] **Step 3: Update the PATCH route**

In `app/api/admin/payout-accounts/[id]/route.ts`, replace the `fields`-building block inside `PATCH`:

```typescript
  const body = await request.json()
  const fields: Record<string, string> = {}
  if (body.label !== undefined) fields.label = body.label.trim()
  // stripe_account_id is system-managed and not updatable via PATCH
```

- [ ] **Step 4: Run all payout-accounts tests**

```bash
npx jest __tests__/api/admin/payout-accounts.test.ts -v
```

Expected: PASS — all tests green

- [ ] **Step 5: Update PayoutAccountsTable**

Replace the full contents of `components/admin/PayoutAccountsTable.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StripeAccount } from '@/types'

interface PayoutAccountsTableProps {
  accounts: StripeAccount[]
}

const inputClass =
  'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50'
const labelClass = 'block text-sm font-medium text-on-surface-variant mb-1.5'

export default function PayoutAccountsTable({ accounts: initial }: PayoutAccountsTableProps) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<StripeAccount[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openAdd() {
    setEditingId(null)
    setLabel('')
    setError(null)
    setShowForm(true)
  }

  function openEdit(account: StripeAccount) {
    setEditingId(account.id)
    setLabel(account.label)
    setError(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setLabel('')
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
          body: JSON.stringify({ label }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Save failed')

        if (editingId) {
          setAccounts((prev) => prev.map((a) => (a.id === editingId ? data : a)))
          cancelForm()
        } else {
          cancelForm()
          router.push(`/admin/payout-accounts/${data.id}`)
        }
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
          disabled={isPending}
          className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-6 py-2.5 hover:opacity-90 transition-opacity text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Account
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-on-surface">
            {editingId ? 'Rename Payout Account' : 'Add Payout Account'}
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
          {!editingId && (
            <p className="text-xs text-on-surface-variant/60">
              A new Stripe connected account will be created automatically. You'll be taken to the onboarding page next.
            </p>
          )}
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
              disabled={isPending || !label.trim()}
              className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-xl px-6 py-2 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? 'Creating…' : editingId ? 'Save' : 'Create & Set Up'}
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
                      <a
                        href={`/admin/payout-accounts/${account.id}`}
                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        Manage
                      </a>
                      <button
                        onClick={() => openEdit(account)}
                        disabled={isPending}
                        className="text-xs text-secondary hover:text-secondary/80 transition-colors disabled:opacity-50"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDelete(account)}
                        disabled={isPending}
                        className="text-xs text-error hover:text-error/80 transition-colors disabled:opacity-50"
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

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/payout-accounts/[id]/route.ts components/admin/PayoutAccountsTable.tsx __tests__/api/admin/payout-accounts.test.ts
git commit -m "feat: label-only payout account form, Manage link per row, immutable stripe_account_id"
```

---

## Task 4: Create StripeConnectPanel component and detail page

**Files:**
- Create: `components/admin/StripeConnectPanel.tsx`
- Create: `app/admin/(protected)/payout-accounts/[id]/page.tsx`

- [ ] **Step 1: Create StripeConnectPanel client component**

Create `components/admin/StripeConnectPanel.tsx`:

```tsx
'use client'

import { loadConnectAndInitialize } from '@stripe/connect-js'
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  ConnectAccountManagement,
} from '@stripe/react-stripe-connect-js'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

interface StripeConnectPanelProps {
  dbAccountId: string
  detailsSubmitted: boolean
  publishableKey: string
}

export default function StripeConnectPanel({
  dbAccountId,
  detailsSubmitted,
  publishableKey,
}: StripeConnectPanelProps) {
  const router = useRouter()
  const [onboardingDone, setOnboardingDone] = useState(detailsSubmitted)

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch('/api/admin/stripe/account-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: dbAccountId }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to create session')
    return data.client_secret as string
  }, [dbAccountId])

  const stripeConnectInstance = loadConnectAndInitialize({
    publishableKey,
    fetchClientSecret,
    appearance: { overlays: 'dialog', variables: { colorPrimary: '#7c3aed' } },
  })

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      {onboardingDone ? (
        <ConnectAccountManagement />
      ) : (
        <ConnectAccountOnboarding
          onExit={() => {
            setOnboardingDone(true)
            router.refresh()
          }}
        />
      )}
    </ConnectComponentsProvider>
  )
}
```

- [ ] **Step 2: Create the detail page server component**

Create `app/admin/(protected)/payout-accounts/[id]/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import StripeConnectPanel from '@/components/admin/StripeConnectPanel'

interface PageProps {
  params: { id: string }
}

export default async function PayoutAccountDetailPage({ params }: PageProps) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const { data: account } = await supabase
    .from('stripe_accounts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!account) notFound()

  const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id)
  const detailsSubmitted = stripeAccount.details_submitted ?? false
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Link
            href="/admin/payout-accounts"
            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            ← Payout Accounts
          </Link>
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">{account.label}</h1>
          <p className="text-on-surface-variant mt-1 font-mono text-sm">{account.stripe_account_id}</p>
        </div>
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6">
          <StripeConnectPanel
            dbAccountId={account.id}
            detailsSubmitted={detailsSubmitted}
            publishableKey={publishableKey}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is in .env.example**

```bash
grep "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" .env.example
```

If missing, add to `.env.example`:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Also verify it is set as a Vercel environment variable:

```bash
vercel env ls
```

If missing: `vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add components/admin/StripeConnectPanel.tsx "app/admin/(protected)/payout-accounts/[id]/page.tsx" .env.example
git commit -m "feat: Stripe Connect embedded onboarding and account management detail page"
```

---

## Self-Review

**Spec coverage:**
- [x] Auto-create Stripe account via API — Task 2
- [x] Admin-only access — all endpoints auth-guarded, pages redirect on no session
- [x] Embedded onboarding — `ConnectAccountOnboarding` in `StripeConnectPanel`
- [x] Embedded account management — `ConnectAccountManagement` in `StripeConnectPanel`
- [x] Navigate to onboarding immediately after account creation — Task 3, `router.push`
- [x] No manual `stripe_account_id` entry — Task 3 removes that field from the form
- [x] PATCH no longer allows `stripe_account_id` override — Task 3

**Placeholder scan:** None found. All steps contain complete code.

**Type consistency:**
- `account.id` (UUID string) passed as `dbAccountId` — used in `fetchClientSecret` body as `account_id` — matches endpoint's `body.account_id` — consistent
- `account.stripe_account_id` (`acct_xxx` string) used for Stripe API calls throughout — consistent
- `fetchClientSecret` returns `Promise<string>` matching `loadConnectAndInitialize` contract — consistent
