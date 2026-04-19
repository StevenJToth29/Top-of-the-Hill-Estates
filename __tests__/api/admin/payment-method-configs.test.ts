/**
 * @jest-environment node
 */
import { GET } from '@/app/api/admin/payment-method-configs/route'
import { PATCH } from '@/app/api/admin/payment-method-configs/[id]/route'
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
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })
    const res = await GET()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })
})

describe('GET /api/admin/payment-method-configs – success', () => {
  test('returns configs array ordered by booking_type then sort_order', async () => {
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
    expect(db.orderFirst).toHaveBeenCalledWith('booking_type')
    expect(db.orderFinal).toHaveBeenCalledWith('sort_order')
  })

  test('returns 500 on database error', async () => {
    const db = createDbMocks({ queryError: { message: 'connection refused' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await GET()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'connection refused' })
  })
})

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
