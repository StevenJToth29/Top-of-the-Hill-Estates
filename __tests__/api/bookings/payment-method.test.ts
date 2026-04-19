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

  test('rounds grand_total correctly to avoid float drift', async () => {
    const db = createDbMocks({
      booking: { ...defaultBooking, total_amount: 1234.56, processing_fee: 0 },
      config: { fee_percent: 2.9, fee_flat: 0.30, is_enabled: true },
    })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({ method_key: 'card' }), routeParams)

    expect(res.status).toBe(200)
    const body = await res.json()
    // 1234.56 * 2.9% + $0.30 = 35.80224 + 0.30 = 36.10224 → rounds to 36.10
    // grand_total = 1234.56 + 36.10 = 1270.66
    expect(body.processing_fee).toBe(36.10)
    expect(body.grand_total).toBe(1270.66)
    // Stripe gets 127066 cents (not 127065 or 127067)
    expect(mockStripeUpdate).toHaveBeenCalledWith('pi_test_123', { amount: 127066 })
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
