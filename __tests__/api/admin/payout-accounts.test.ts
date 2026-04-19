/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/admin/payout-accounts/route'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

jest.mock('@/lib/stripe', () => ({
  stripe: {
    accounts: { create: jest.fn() },
  },
}))

const mockStripeAccountsCreate = stripe.accounts.create as jest.Mock

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
  test('returns 401 when not authenticated', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })

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
  // Mock for: supabase.from('properties').select('id', { count: 'exact', head: true }).eq(...)
  const propertiesEq = jest.fn().mockResolvedValue({ count: opts.propertyCount ?? 0, error: null })
  const propertiesSelect = jest.fn().mockReturnValue({ eq: propertiesEq })

  // Mock for: supabase.from('stripe_accounts').delete().eq(...)
  const accountsEq = jest.fn().mockResolvedValue({ error: opts.deleteError ?? null })
  const deleteFn = jest.fn().mockReturnValue({ eq: accountsEq })

  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'properties') return { select: propertiesSelect }
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

  test('returns 400 when no fields provided', async () => {
    const db = makePatchDbMock()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makePatchRequest({}), { params: { id: 'acc-1' } })
    expect(res.status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })

  test('returns 500 on DB error', async () => {
    const db = makePatchDbMock({ updateError: { message: 'update failed' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makePatchRequest({ label: 'X' }), { params: { id: 'acc-1' } })
    expect(res.status).toBe(500)
  })

  test('does not update stripe_account_id even if provided', async () => {
    const updated = { id: 'acc-1', label: 'Updated Label', stripe_account_id: 'acct_aaa', created_at: '2026-01-01' }
    const db = makePatchDbMock({ updateData: updated })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makePatchRequest({ label: 'Updated Label', stripe_account_id: 'acct_injected' }), { params: { id: 'acc-1' } })

    expect(db.update).toHaveBeenCalledWith({ label: 'Updated Label' })
    expect(db.update).not.toHaveBeenCalledWith(expect.objectContaining({ stripe_account_id: expect.anything() }))
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
