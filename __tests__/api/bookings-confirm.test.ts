/** @jest-environment node */

jest.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      retrieve: jest.fn(),
      cancel: jest.fn().mockResolvedValue({}),
    },
  },
}))

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}))

jest.mock('@/lib/email-queue', () => ({
  evaluateAndQueueEmails: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/availability', () => ({
  isRoomAvailableExcluding: jest.fn().mockResolvedValue(true),
}))

import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { isRoomAvailableExcluding } from '@/lib/availability'
import { POST } from '@/app/api/bookings/[id]/confirm/route'

const mockParams = { params: { id: 'booking-1' } }

function makeRequest() {
  return new Request('http://localhost/api/bookings/booking-1/confirm', { method: 'POST' })
}

const baseBooking = {
  id: 'booking-1',
  status: 'pending',
  stripe_payment_intent_id: 'pi_test',
  room_id: 'room-1',
  check_in: '2026-05-01',
  check_out: '2026-05-05',
}

function setupMocks(booking: Record<string, unknown> | null, piStatus = 'requires_capture') {
  // Keep the fetch chain separate from the update chain — spreading updateChain into the fetch
  // object would have overridden eq/select/single, causing the fetch to return update results.
  const fetchChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: booking,
      error: booking ? null : { message: 'not found' },
    }),
  }

  const updatedBooking = booking ? { ...booking, status: 'pending_docs' } : null
  const updateSelectChain = {
    single: jest.fn().mockResolvedValue({ data: updatedBooking, error: null }),
  }
  const updateChain = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnValue(updateSelectChain),
  }

  // First from('bookings') call = fetch; subsequent calls = update
  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn()
      .mockReturnValueOnce(fetchChain)
      .mockReturnValue(updateChain),
  })

  ;(stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValue({
    id: 'pi_test',
    status: piStatus,
    amount: 50000,
    amount_received: 50000,
  })
}

describe('POST /api/bookings/[id]/confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(isRoomAvailableExcluding as jest.Mock).mockResolvedValue(true)
  })

  it('moves a pending booking to pending_docs when PI status is requires_capture', async () => {
    setupMocks(baseBooking)

    const res = await POST(makeRequest(), mockParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe('pending_docs')
    expect(stripe.paymentIntents.retrieve as jest.Mock).toHaveBeenCalledWith('pi_test')
  })

  it('moves a pending_payment booking to pending_docs when PI status is requires_capture', async () => {
    setupMocks({ ...baseBooking, status: 'pending_payment' })

    const res = await POST(makeRequest(), mockParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe('pending_docs')
  })

  it('accepts PI status succeeded (legacy captured payment)', async () => {
    setupMocks(baseBooking, 'succeeded')
    const res = await POST(makeRequest(), mockParams)
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('pending_docs')
  })

  it('accepts PI status processing (ACH/bank transfer in flight)', async () => {
    setupMocks(baseBooking, 'processing')
    const res = await POST(makeRequest(), mockParams)
    expect(res.status).toBe(200)
  })

  it('accepts PI status requires_action (micro-deposit verification pending)', async () => {
    setupMocks(baseBooking, 'requires_action')
    const res = await POST(makeRequest(), mockParams)
    expect(res.status).toBe(200)
  })

  it('returns 400 when PI status is requires_payment_method (payment not authorized)', async () => {
    setupMocks(baseBooking, 'requires_payment_method')
    const res = await POST(makeRequest(), mockParams)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/payment not yet authorized/i)
  })

  it('returns 200 with status pending_docs when booking is already pending_docs (idempotent)', async () => {
    setupMocks({ ...baseBooking, status: 'pending_docs' })

    const res = await POST(makeRequest(), mockParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe('pending_docs')
    // Should NOT call Stripe — no need to re-verify
    expect(stripe.paymentIntents.retrieve as jest.Mock).not.toHaveBeenCalled()
  })

  it('returns 200 early when booking is already confirmed', async () => {
    setupMocks({ ...baseBooking, status: 'confirmed' })

    const res = await POST(makeRequest(), mockParams)
    expect(res.status).toBe(200)
    expect(stripe.paymentIntents.retrieve as jest.Mock).not.toHaveBeenCalled()
  })

  it('returns 409 and voids payment when dates are no longer available', async () => {
    setupMocks(baseBooking)
    ;(isRoomAvailableExcluding as jest.Mock).mockResolvedValue(false)

    const res = await POST(makeRequest(), mockParams)
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toMatch(/no longer available/i)
    expect(stripe.paymentIntents.cancel as jest.Mock).toHaveBeenCalledWith('pi_test')
  })

  it('returns 404 when booking does not exist', async () => {
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      })),
    })

    const res = await POST(makeRequest(), mockParams)
    expect(res.status).toBe(404)
  })

  it('returns 400 when booking has no stripe_payment_intent_id', async () => {
    setupMocks({ ...baseBooking, stripe_payment_intent_id: null })

    const res = await POST(makeRequest(), mockParams)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/no payment intent/i)
  })

  it('returns 400 when booking status is cancelled (cannot be confirmed)', async () => {
    setupMocks({ ...baseBooking, status: 'cancelled' })

    const res = await POST(makeRequest(), mockParams)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/cannot be confirmed/i)
  })
})
