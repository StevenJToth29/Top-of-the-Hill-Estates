/** @jest-environment node */

jest.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      update: jest.fn().mockResolvedValue({}),
    },
  },
}))

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}))

import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { PATCH } from '@/app/api/bookings/[id]/payment-method/route'

const mockParams = { params: { id: 'booking-1' } }

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/bookings/booking-1/payment-method', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseBooking = {
  id: 'booking-1',
  booking_type: 'short_term',
  total_amount: 500,
  processing_fee: 0,
  status: 'pending',
  stripe_payment_intent_id: 'pi_test',
  room: {
    property: {
      platform_fee_percent: 0,
      stripe_account: null,
    },
  },
}

function setupMocks(
  booking = baseBooking,
  methodConfig: { fee_percent: number; fee_flat: number; is_enabled: boolean } = {
    fee_percent: 2.9,
    fee_flat: 0.30,
    is_enabled: true,
  },
) {
  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: booking, error: null }),
          update: jest.fn().mockReturnThis(),
        }
      }
      if (table === 'payment_method_configs') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: methodConfig, error: null }),
          order: jest.fn().mockResolvedValue({ data: [{ method_key: 'card' }], error: null }),
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnThis(),
      }
    }),
  })
}

describe('PATCH /api/bookings/[id]/payment-method', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when method_key is missing from request body', async () => {
    setupMocks()
    const res = await PATCH(makeRequest({}), mockParams)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/method_key is required/i)
  })

  it('calculates processing_fee and grand_total correctly for card (2.9% + $0.30)', async () => {
    setupMocks()
    const res = await PATCH(makeRequest({ method_key: 'card' }), mockParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    // base=500, gross-up: (500+0.30)/(1-0.029) = 515.24 → fee = 15.24
    expect(data.processing_fee).toBeCloseTo(15.24, 2)
    expect(data.grand_total).toBeCloseTo(515.24, 2)
  })

  it('updates the Stripe PaymentIntent amount to reflect the grand total', async () => {
    setupMocks()
    await PATCH(makeRequest({ method_key: 'card' }), mockParams)

    expect(stripe.paymentIntents.update as jest.Mock).toHaveBeenCalledWith(
      'pi_test',
      expect.objectContaining({ amount: 51524 }), // 515.24 in cents
    )
  })

  it('switching payment method recalculates fee from the original base amount', async () => {
    // Simulate a booking that already has a card fee applied (processing_fee = 14.80)
    const bookingWithFee = { ...baseBooking, total_amount: 514.80, processing_fee: 14.80 }
    // Switch to a flat-fee method (e.g. ACH: 0.8% + $0)
    setupMocks(bookingWithFee, { fee_percent: 0.8, fee_flat: 0, is_enabled: true })

    const res = await PATCH(makeRequest({ method_key: 'us_bank_account' }), mockParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    // base_amount = 514.80 - 14.80 = 500
    // gross-up: 500/(1-0.008) = 504.03 → fee = 4.03
    expect(data.processing_fee).toBeCloseTo(4.03, 2)
    expect(data.grand_total).toBeCloseTo(504.03, 2)
  })

  it('returns 400 when the requested payment method is disabled', async () => {
    setupMocks(baseBooking, { fee_percent: 2.9, fee_flat: 0.30, is_enabled: false })

    const res = await PATCH(makeRequest({ method_key: 'card' }), mockParams)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/not available/i)
  })

  it('returns 400 when payment method config is not found', async () => {
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'bookings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: baseBooking, error: null }),
            update: jest.fn().mockReturnThis(),
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }
      }),
    })

    const res = await PATCH(makeRequest({ method_key: 'unknown_method' }), mockParams)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/payment method not found/i)
  })

  it('returns 404 when booking does not exist', async () => {
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      })),
    })

    const res = await PATCH(makeRequest({ method_key: 'card' }), mockParams)
    expect(res.status).toBe(404)
  })

  it('returns 400 when booking is not in pending, pending_payment, or pending_docs status', async () => {
    setupMocks({ ...baseBooking, status: 'confirmed' })

    const res = await PATCH(makeRequest({ method_key: 'card' }), mockParams)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/not in pending status/i)
  })

  it('accepts pending_payment status (card not yet submitted)', async () => {
    setupMocks({ ...baseBooking, status: 'pending_payment' })

    const res = await PATCH(makeRequest({ method_key: 'card' }), mockParams)
    expect(res.status).toBe(200)
  })

  it('returns 409 when booking has no Stripe payment intent', async () => {
    setupMocks({ ...baseBooking, stripe_payment_intent_id: null })

    const res = await PATCH(makeRequest({ method_key: 'card' }), mockParams)
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toMatch(/payment session not found/i)
  })

  it('rolls back the DB update if the Stripe PaymentIntent update fails', async () => {
    const dbUpdateMock = jest.fn().mockReturnThis()
    const dbEqMock = jest.fn().mockResolvedValue({ error: null })

    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'bookings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: baseBooking, error: null }),
            update: dbUpdateMock,
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { fee_percent: 2.9, fee_flat: 0.30, is_enabled: true },
            error: null,
          }),
        }
      }),
    })

    // Stripe update throws
    ;(stripe.paymentIntents.update as jest.Mock).mockRejectedValue(new Error('Stripe error'))

    const res = await PATCH(makeRequest({ method_key: 'card' }), mockParams)
    expect(res.status).toBe(500)

    // DB rollback update should have been called (update called twice: once to apply, once to revert)
    expect(dbUpdateMock).toHaveBeenCalledTimes(2)
  })

  it('includes application_fee_amount in Stripe update when connected account is present', async () => {
    const bookingWithAccount = {
      ...baseBooking,
      room: {
        property: {
          platform_fee_percent: 10,
          stripe_account: { stripe_account_id: 'acct_connected' },
        },
      },
    }
    setupMocks(bookingWithAccount)

    await PATCH(makeRequest({ method_key: 'card' }), mockParams)

    // platform fee = 500 * 10% = 50 → 5000 cents; processing fee = 15.24 → 1524 cents
    // application_fee_amount = 5000 + 1524 = 6524
    expect(stripe.paymentIntents.update as jest.Mock).toHaveBeenCalledWith(
      'pi_test',
      expect.objectContaining({ application_fee_amount: 6524 }),
    )
  })
})
