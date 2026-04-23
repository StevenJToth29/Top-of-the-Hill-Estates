/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))
jest.mock('@/lib/stripe', () => ({
  stripe: { refunds: { create: jest.fn().mockResolvedValue({}) } },
}))
jest.mock('@/lib/cancellation', () => ({
  calculateRefund: jest.fn().mockReturnValue({ refund_amount: 100, refund_percentage: 100, policy_description: 'Full refund.' }),
  resolvePolicy: jest.fn().mockReturnValue({ full_refund_days: 7, partial_refund_hours: 72, partial_refund_percent: 50 }),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { calculateRefund } from '@/lib/cancellation'
import { POST } from '@/app/api/bookings/[id]/cancel/guest/route'

const mockParams = { params: { id: 'booking-1' } }

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/bookings/booking-1/cancel/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseBooking = {
  id: 'booking-1',
  guest_email: 'jane@example.com',
  status: 'confirmed',
  room_id: 'room-1',
  stripe_payment_intent_id: 'pi_test',
  amount_paid: 100,
  check_in: '2026-06-20',
  booking_type: 'short_term',
}

function setupMocks(booking = baseBooking, windowHours = 72) {
  const updateChain = {
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'booking-1' }, error: null }),
  }
  const update = jest.fn().mockReturnValue(updateChain)

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: booking, error: null }),
          update,
        }
      }
      if (table === 'rooms') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { property_id: null, cancellation_policy: null, use_property_cancellation_policy: null }, error: null }),
        }
      }
      if (table === 'properties' || table === 'site_settings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null }),
        }
      }
    }),
  })
  return { update }
}

describe('POST /api/bookings/[id]/cancel/guest', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if guest_email is missing', async () => {
    setupMocks()
    const res = await POST(makeRequest({}), mockParams as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 if booking not found', async () => {
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      })),
    })
    const res = await POST(makeRequest({ guest_email: 'jane@example.com' }), mockParams as never)
    expect(res.status).toBe(404)
  })

  it('returns 403 if email does not match', async () => {
    setupMocks()
    const res = await POST(makeRequest({ guest_email: 'wrong@example.com' }), mockParams as never)
    expect(res.status).toBe(403)
  })

  it('returns 400 if booking is not confirmed', async () => {
    setupMocks({ ...baseBooking, status: 'cancelled' })
    const res = await POST(makeRequest({ guest_email: 'jane@example.com' }), mockParams as never)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/current state/i)
  })

  it('cancels the booking and issues a Stripe refund', async () => {
    const { update } = setupMocks()
    const res = await POST(makeRequest({ guest_email: 'jane@example.com' }), mockParams as never)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.refund_amount).toBe(100)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled', cancellation_reason: 'guest_requested' }))
    expect((stripe.refunds.create as jest.Mock)).toHaveBeenCalledWith({ payment_intent: 'pi_test', amount: 10000, reverse_transfer: true })
  })

  it('does not issue Stripe refund when refund_amount is 0', async () => {
    setupMocks()
    ;(calculateRefund as jest.Mock).mockReturnValueOnce({ refund_amount: 0, refund_percentage: 0, policy_description: 'No refund.' })
    await POST(makeRequest({ guest_email: 'jane@example.com' }), mockParams as never)
    expect((stripe.refunds.create as jest.Mock)).not.toHaveBeenCalled()
  })
})
