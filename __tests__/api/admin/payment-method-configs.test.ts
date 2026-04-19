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
