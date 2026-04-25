/** @jest-environment node */
// __tests__/api/booking-application.test.ts

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))
jest.mock('@/lib/email-queue', () => ({ evaluateAndQueueEmails: jest.fn().mockResolvedValue(undefined) }))

import { createServiceRoleClient } from '@/lib/supabase'
import { GET, POST, PATCH } from '@/app/api/bookings/[id]/application/route'

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeReq(method: string, body?: object) {
  return new Request('http://localhost/api/bookings/test-id/application', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function setupMocks({ booking = null, application = null }: {
  booking?: Record<string, unknown> | null
  application?: Record<string, unknown> | null
}) {
  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: table === 'bookings' ? booking : application,
        error: null,
      }),
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: application, error: null }),
    })),
  })
}

describe('GET /api/bookings/[id]/application', () => {
  it('returns 404 when booking not found', async () => {
    setupMocks({ booking: null })
    const res = await GET(makeReq('GET'), makeCtx('missing-id'))
    expect(res.status).toBe(404)
  })

  it('returns 403 when booking not in pending_docs or under_review', async () => {
    setupMocks({ booking: { id: 'b1', status: 'confirmed', guest_count: 1 } })
    const res = await GET(makeReq('GET'), makeCtx('b1'))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/bookings/[id]/application', () => {
  it('returns 400 when booking not in pending_docs', async () => {
    setupMocks({ booking: { id: 'b1', status: 'confirmed', guest_count: 1 } })
    const res = await POST(makeReq('POST', {}), makeCtx('b1'))
    expect(res.status).toBe(400)
  })
})
