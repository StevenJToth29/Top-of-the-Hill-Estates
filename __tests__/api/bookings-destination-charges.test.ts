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

  // Supabase mock chain: from().select().eq().eq().single()  (room query)
  //                     from().select().limit().single()      (settings query)
  //                     from().insert().select().single()     (booking insert)
  //                     from().select().in().{resolve}        (room fees query)
  //                     from().insert().{resolve}             (booking_fees inserts)

  let singleCallCount = 0
  const single = jest.fn().mockImplementation(() => {
    singleCallCount++
    if (singleCallCount === 1) return Promise.resolve({ data: roomData, error: null })
    if (singleCallCount === 2) return Promise.resolve({ data: settingsData, error: null })
    return Promise.resolve({ data: bookingData, error: null })
  })

  const head = jest.fn().mockResolvedValue({ count: null, error: null })
  const inFn = jest.fn().mockResolvedValue({ data: [], error: null })
  const limit = jest.fn().mockReturnValue({ single })
  const eqChain = jest.fn().mockReturnValue({ single, eq: jest.fn().mockReturnValue({ single, in: inFn }), in: inFn })
  const selectChain = jest.fn().mockReturnValue({ eq: eqChain, limit, in: inFn, single })
  const insertSelectChain = jest.fn().mockReturnValue({ single })
  const insertChain = jest.fn().mockReturnValue({ select: insertSelectChain, then: jest.fn().mockImplementation((resolve: (val: unknown) => void) => resolve({ error: null })) })
  const from = jest.fn().mockReturnValue({ select: selectChain, insert: insertChain })

  return { from }
}

const mockSyncToGHL = syncToGHL as jest.Mock

beforeEach(() => {
  mockIsRoomAvailable.mockResolvedValue(true)
  mockSyncToGHL.mockResolvedValue(undefined)
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
    expect(createCall.application_fee_amount).toBe(9267)
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
