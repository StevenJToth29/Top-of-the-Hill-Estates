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
