/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

jest.mock('@/lib/availability', () => ({
  isRoomAvailableExcluding: jest.fn().mockResolvedValue(true),
}))

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { isRoomAvailableExcluding } from '@/lib/availability'
import { PATCH } from '@/app/api/admin/bookings/[id]/modification-requests/[reqId]/route'

const mockParams = { params: { id: 'booking-1', reqId: 'req-1' } }

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/bookings/booking-1/modification-requests/req-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const pendingRequest = {
  id: 'req-1',
  booking_id: 'booking-1',
  status: 'pending',
  requested_check_in: '2026-07-01',
  requested_check_out: '2026-07-05',
  requested_total_nights: 4,
  requested_guest_count: 2,
  price_delta: null,
}

function setupMocks(modRequest = pendingRequest, bookingUpdateError: unknown = null) {
  const authedUser = { id: 'admin-1' }

  const bookingSelectChain = {
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { total_amount: 400, room_id: 'room-1' }, error: null }),
  }
  const bookingUpdateChain = { eq: jest.fn().mockResolvedValue({ error: bookingUpdateError }) }
  const bookingUpdate = jest.fn().mockReturnValue(bookingUpdateChain)

  const reqUpdateChain = { eq: jest.fn().mockResolvedValue({ error: null }) }
  const reqUpdate = jest.fn().mockReturnValue(reqUpdateChain)

  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: authedUser }, error: null }) },
  })

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'booking_modification_requests') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: modRequest, error: null }),
          update: reqUpdate,
        }
      }
      if (table === 'bookings') {
        return { select: jest.fn().mockReturnValue(bookingSelectChain), update: bookingUpdate }
      }
    }),
  })

  return { bookingUpdate, reqUpdate }
}

describe('PATCH /api/admin/bookings/[id]/modification-requests/[reqId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(isRoomAvailableExcluding as jest.Mock).mockResolvedValue(true)
  })

  it('returns 401 if not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error('no session') }) },
    })
    const res = await PATCH(makeRequest({ action: 'approve' }), mockParams as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 if action is invalid', async () => {
    setupMocks()
    const res = await PATCH(makeRequest({ action: 'delete' }), mockParams as never)
    expect(res.status).toBe(400)
  })

  it('approve: updates booking dates and marks request approved', async () => {
    const { bookingUpdate, reqUpdate } = setupMocks()
    const res = await PATCH(makeRequest({ action: 'approve', admin_note: 'Approved!' }), mockParams as never)
    expect(res.status).toBe(200)
    expect(bookingUpdate).toHaveBeenCalledWith({
      check_in: '2026-07-01',
      check_out: '2026-07-05',
      total_nights: 4,
      guest_count: 2,
    })
    expect(reqUpdate).toHaveBeenCalledWith({ status: 'approved', admin_note: 'Approved!' })
  })

  it('reject: updates request to rejected without touching booking', async () => {
    const { bookingUpdate, reqUpdate } = setupMocks()
    const res = await PATCH(makeRequest({ action: 'reject', admin_note: 'Dates not available.' }), mockParams as never)
    expect(res.status).toBe(200)
    expect(bookingUpdate).not.toHaveBeenCalled()
    expect(reqUpdate).toHaveBeenCalledWith({ status: 'rejected', admin_note: 'Dates not available.' })
  })

  it('approve: returns 409 if room is no longer available', async () => {
    setupMocks()
    ;(isRoomAvailableExcluding as jest.Mock).mockResolvedValue(false)
    const res = await PATCH(makeRequest({ action: 'approve' }), mockParams as never)
    expect(res.status).toBe(409)
  })

  it('returns 400 if request is not pending', async () => {
    setupMocks({ ...pendingRequest, status: 'approved' })
    const res = await PATCH(makeRequest({ action: 'approve' }), mockParams as never)
    expect(res.status).toBe(400)
  })
})
