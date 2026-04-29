/** @jest-environment node */

process.env.CRON_SECRET = 'test-cron-secret'

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))
jest.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      retrieve: jest.fn(),
      cancel: jest.fn().mockResolvedValue({}),
    },
  },
}))
jest.mock('@/lib/email-queue', () => ({
  evaluateAndQueueEmails: jest.fn().mockResolvedValue(undefined),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { evaluateAndQueueEmails } from '@/lib/email-queue'
import { GET } from '@/app/api/cron/expire-pending-bookings/route'

function makeRequest(secret = 'test-cron-secret') {
  return new Request('http://localhost/api/cron/expire-pending-bookings', {
    headers: { Authorization: `Bearer ${secret}` },
  })
}

const staleBooking = { id: 'booking-1', stripe_payment_intent_id: 'pi_test' }
const staleBookingNoPI = { id: 'booking-2', stripe_payment_intent_id: null }

function buildDbMock(pendingRows: unknown[]) {
  const inChain = { error: null }
  const updateChain = { in: jest.fn().mockResolvedValue(inChain) }
  const makeSelectChain = (rows: unknown[]) => {
    const chain: Record<string, unknown> = {}
    chain.select = jest.fn().mockReturnValue(chain)
    chain.eq = jest.fn().mockReturnValue(chain)
    chain.lt = jest.fn().mockResolvedValue({ data: rows, error: null })
    chain.update = jest.fn().mockReturnValue(updateChain)
    return chain
  }
  // Each from() call gets a fresh chain; sweep0 and sweep2/3 get [] rows, sweep1 gets pendingRows
  let callCount = 0
  const from = jest.fn().mockImplementation(() => {
    callCount++
    if (callCount === 2) return makeSelectChain(pendingRows) // sweep1 select
    return makeSelectChain([]) // sweep0, sweep2, sweep3 selects + all updates
  })
  return from
}

describe('expire-pending-bookings cron', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 with wrong secret', async () => {
    const res = await GET(makeRequest('wrong') as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(401)
  })

  it('expires bookings and queues a recovery email for each', async () => {
    ;(stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValue({ status: 'requires_payment_method' })
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: buildDbMock([staleBooking]) })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.expired).toBe(1)
    expect(data.failed).toBe(0)
    expect(evaluateAndQueueEmails).toHaveBeenCalledWith('booking_abandoned', {
      type: 'booking',
      bookingId: 'booking-1',
    })
  })

  it('skips Stripe cancel when payment intent is absent', async () => {
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: buildDbMock([staleBookingNoPI]) })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled()
    expect(evaluateAndQueueEmails).toHaveBeenCalledWith('booking_abandoned', {
      type: 'booking',
      bookingId: 'booking-2',
    })
  })

  it('counts failed bookings but still processes others', async () => {
    ;(stripe.paymentIntents.retrieve as jest.Mock).mockRejectedValue(new Error('Stripe down'))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: buildDbMock([staleBooking]) })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    const data = await res.json()
    expect(data.failed).toBe(1)
    // booking_abandoned not called — the booking failed to expire
    expect(evaluateAndQueueEmails).not.toHaveBeenCalledWith('booking_abandoned', expect.anything())
  })
})
