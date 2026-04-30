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
    paymentIntents: {
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}))

const mockCreateServiceClient = createServiceRoleClient as jest.Mock
const mockStripeUpdate = (stripe.paymentIntents.update as jest.Mock)
const mockStripeCreate = (stripe.paymentIntents.create as jest.Mock)

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
  const configOrder = jest.fn().mockResolvedValue({ data: [{ method_key: 'card' }], error: null })
  const configEqMethod = jest.fn().mockReturnValue({ single: configSingle, order: configOrder })
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
    // base=500, gross-up: (500+0.30)/(1-0.029) = 515.24 → fee = 15.24
    expect(body.processing_fee).toBe(15.24)
    expect(body.grand_total).toBe(515.24)
    expect(mockStripeUpdate).toHaveBeenCalledWith('pi_test_123', { amount: 51524 })
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
    // base=1234.56, gross-up: (1234.56+0.30)/(1-0.029) = 1271.74 → fee = 37.18
    expect(body.processing_fee).toBe(37.18)
    expect(body.grand_total).toBe(1271.74)
    expect(mockStripeUpdate).toHaveBeenCalledWith('pi_test_123', { amount: 127174 })
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

  test('sets application_fee_amount to (base × platform_fee_percent) + processing_fee when connected account exists', async () => {
    // $450 base, 20% platform fee, card method (2.9% + $0.30)
    // gross-up: (450+0.30)/(1-0.029) = 463.75 → processing_fee = 13.75
    // application_fee_amount = round(450 * 0.20 * 100) + round(13.75 * 100) = 9000 + 1375 = 10375
    // connected account receives: 46375 - 10375 = 36000 cents = $360 = base × 80%
    const bookingWithProperty = {
      ...defaultBooking,
      total_amount: 450,
      processing_fee: 0,
      room: {
        property: {
          platform_fee_percent: 20,
          stripe_account: { stripe_account_id: 'acct_test123' },
        },
      },
    }
    const db = createDbMocks({ booking: bookingWithProperty })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({ method_key: 'card' }), routeParams)

    expect(res.status).toBe(200)
    expect(mockStripeUpdate).toHaveBeenCalledWith('pi_test_123', {
      amount: 46375,
      application_fee_amount: 10375,
    })
  })

  test('omits application_fee_amount when no connected account', async () => {
    const bookingNoAccount = {
      ...defaultBooking,
      total_amount: 450,
      processing_fee: 0,
      room: { property: { platform_fee_percent: 20, stripe_account: null } },
    }
    const db = createDbMocks({ booking: bookingNoAccount })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest({ method_key: 'card' }), routeParams)

    expect(mockStripeUpdate).toHaveBeenCalledWith('pi_test_123', { amount: 46375 })
  })

  test('updates booking processing_fee and total_amount', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest({ method_key: 'card' }), routeParams)

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_fee: 15.24, total_amount: 515.24 })
    )
    expect(db.updateEq).toHaveBeenCalledWith('id', 'booking-1')
  })
})

// ---------------------------------------------------------------------------
// Helpers for the expired-session recovery tests
// ---------------------------------------------------------------------------

const allEnabledMethods = [
  { method_key: 'card' },
  { method_key: 'us_bank_account' },
  { method_key: 'cashapp' },
]

/**
 * Like createDbMocks but the payment_method_configs table mock supports BOTH
 * query paths the route now makes:
 *   1. .select(...).eq('booking_type', …).eq('method_key', …).single()   → selected method config
 *   2. .select('method_key').eq('booking_type', …).eq('is_enabled', true).order('sort_order') → all enabled methods
 *
 * Both paths share the same eq→eq chain so we return a terminal object that
 * has BOTH .single() and .order() on it.
 */
function createDbMocksWithAllMethods(opts: {
  booking?: unknown
  bookingError?: unknown
  config?: unknown
  configError?: unknown
  updateError?: unknown
  allMethods?: { method_key: string }[]
} = {}) {
  const updateEq = jest.fn().mockResolvedValue({ error: opts.updateError ?? null })
  const update = jest.fn().mockReturnValue({ eq: updateEq })

  // Terminal node that both eq chains resolve to — supports .single() and .order()
  const configTerminal = {
    single: jest.fn().mockResolvedValue({
      data: opts.config !== undefined ? opts.config : cardConfig,
      error: opts.configError ?? null,
    }),
    order: jest.fn().mockResolvedValue({
      data: opts.allMethods !== undefined ? opts.allMethods : allEnabledMethods,
      error: null,
    }),
  }
  const configEqMethod = jest.fn().mockReturnValue(configTerminal)
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

  return { from, update, updateEq, configTerminal }
}

describe('PATCH /api/bookings/[id]/payment-method – expired session recovery', () => {
  beforeEach(() => {
    mockStripeUpdate.mockResolvedValue({})
    mockStripeCreate.mockResolvedValue({
      id: 'pi_fresh_1',
      client_secret: 'secret_fresh_1',
    })
  })

  test('happy path — replacement PI created when update throws payment_intent_unexpected_state', async () => {
    const unexpectedStateErr = Object.assign(new Error('unexpected state'), {
      code: 'payment_intent_unexpected_state',
    })
    mockStripeUpdate.mockRejectedValueOnce(unexpectedStateErr)

    const db = createDbMocksWithAllMethods()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({ method_key: 'card' }), routeParams)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      processing_fee: expect.any(Number),
      grand_total: expect.any(Number),
      newClientSecret: 'secret_fresh_1',
    })
    expect(mockStripeCreate).toHaveBeenCalledTimes(1)
  })

  test('replacement PI uses all enabled methods, not just the selected one', async () => {
    const unexpectedStateErr = Object.assign(new Error('unexpected state'), {
      code: 'payment_intent_unexpected_state',
    })
    mockStripeUpdate.mockRejectedValueOnce(unexpectedStateErr)

    const db = createDbMocksWithAllMethods()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest({ method_key: 'card' }), routeParams)

    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: ['card', 'us_bank_account', 'cashapp'],
      }),
    )
  })

  test('DB updated with fresh PI id after replacement PI creation', async () => {
    const unexpectedStateErr = Object.assign(new Error('unexpected state'), {
      code: 'payment_intent_unexpected_state',
    })
    mockStripeUpdate.mockRejectedValueOnce(unexpectedStateErr)
    mockStripeCreate.mockResolvedValueOnce({
      id: 'pi_fresh_new',
      client_secret: 'secret_fresh_new',
    })

    const db = createDbMocksWithAllMethods()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest({ method_key: 'card' }), routeParams)

    // The second update call (after rollback + fresh PI) should include the new PI id
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_payment_intent_id: 'pi_fresh_new' }),
    )
    expect(db.updateEq).toHaveBeenCalledWith('id', 'booking-1')
  })

  test('fallback to 409 if fresh PI creation fails', async () => {
    const unexpectedStateErr = Object.assign(new Error('unexpected state'), {
      code: 'payment_intent_unexpected_state',
    })
    mockStripeUpdate.mockRejectedValueOnce(unexpectedStateErr)
    mockStripeCreate.mockRejectedValueOnce(new Error('Stripe create failed'))

    const db = createDbMocksWithAllMethods()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({ method_key: 'card' }), routeParams)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('This booking session has expired. Please start a new booking.')
  })

  test('other Stripe errors re-throw to 500 (not payment_intent_unexpected_state)', async () => {
    const otherErr = Object.assign(new Error('card declined'), {
      code: 'card_declined',
    })
    mockStripeUpdate.mockRejectedValueOnce(otherErr)

    const db = createDbMocksWithAllMethods()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest({ method_key: 'card' }), routeParams)

    expect(res.status).toBe(500)
    expect(mockStripeCreate).not.toHaveBeenCalled()
  })
})
