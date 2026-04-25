/**
 * @jest-environment node
 */
// __tests__/api/admin/application-review.test.ts

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn(), createServerSupabaseClient: jest.fn() }))
jest.mock('@/lib/stripe', () => ({
  capturePaymentIntent: jest.fn().mockResolvedValue(undefined),
  stripe: { paymentIntents: { retrieve: jest.fn().mockResolvedValue({ status: 'requires_capture' }), cancel: jest.fn().mockResolvedValue({}) } }
}))
jest.mock('@/lib/email-queue', () => ({
  evaluateAndQueueEmails: jest.fn().mockResolvedValue(undefined),
  seedReminderEmails: jest.fn().mockResolvedValue(undefined)
}))

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { PATCH } from '@/app/api/admin/bookings/[id]/application/review/route'

function makeReq(body: object) {
  return new Request('http://localhost/api/admin/bookings/test/application/review', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setupMocks(booking: Record<string, unknown> | null, authed = true) {
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: authed ? { id: 'admin-1' } : null }, error: null }) },
  })
  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: booking, error: null }),
      update: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  })
}

describe('PATCH /api/admin/bookings/[id]/application/review', () => {
  it('returns 401 when not authenticated', async () => {
    setupMocks(null, false)
    const res = await PATCH(makeReq({ decision: 'approved' }), { params: Promise.resolve({ id: 'b1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when booking not found', async () => {
    setupMocks(null)
    const res = await PATCH(makeReq({ decision: 'approved' }), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid decision', async () => {
    setupMocks({ id: 'b1', status: 'under_review', stripe_payment_intent_id: 'pi_test' })
    const res = await PATCH(makeReq({ decision: 'maybe' }), { params: Promise.resolve({ id: 'b1' }) })
    expect(res.status).toBe(400)
  })
})
