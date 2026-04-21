/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))
jest.mock('@/lib/cancellation', () => ({
  isWithinCancellationWindow: jest.fn().mockReturnValue(false),
}))
jest.mock('@/lib/availability', () => ({
  isRoomAvailableExcluding: jest.fn().mockResolvedValue(true),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import { isRoomAvailableExcluding } from '@/lib/availability'
import { POST } from '@/app/api/bookings/[id]/modify/route'

const mockParams = { params: { id: 'booking-1' } }

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/bookings/booking-1/modify', {
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
  booking_type: 'short_term',
  total_amount: 550,
  nightly_rate: 100,
  monthly_rate: 0,
  cleaning_fee: 50,
  security_deposit: 0,
  extra_guest_fee: 0,
  check_in: '2026-06-10',
  check_out: '2026-06-15',
  room: {
    nightly_rate: 100,
    monthly_rate: 0,
    cleaning_fee: 50,
    security_deposit: 0,
    extra_guest_fee: 0,
    guest_capacity: 4,
    minimum_nights_short_term: 1,
    minimum_nights_long_term: 30,
    cancellation_window_hours: 72,
  },
}

const validBody = {
  guest_email: 'jane@example.com',
  check_in: '2026-07-01',
  check_out: '2026-07-05',
  guest_count: 2,
}

function setupMocks(booking = baseBooking, existingRequest: unknown = null) {
  const insertChain = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'req-1' }, error: null }),
  }

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: booking, error: null }),
        }
      }
      if (table === 'booking_modification_requests') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: existingRequest, error: null }),
          insert: jest.fn().mockReturnValue(insertChain),
        }
      }
      if (table === 'booking_fees') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
    }),
  })
}

describe('POST /api/bookings/[id]/modify', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if required fields are missing', async () => {
    setupMocks()
    const res = await POST(makeRequest({ guest_email: 'jane@example.com' }), mockParams as never)
    expect(res.status).toBe(400)
  })

  it('returns 403 if email does not match', async () => {
    setupMocks()
    const res = await POST(makeRequest({ ...validBody, guest_email: 'other@example.com' }), mockParams as never)
    expect(res.status).toBe(403)
  })

  it('returns 400 if booking is not confirmed', async () => {
    setupMocks({ ...baseBooking, status: 'cancelled' })
    const res = await POST(makeRequest(validBody), mockParams as never)
    expect(res.status).toBe(400)
  })

  it('returns 409 if a pending modification request already exists', async () => {
    setupMocks(baseBooking, { id: 'req-existing' })
    const res = await POST(makeRequest(validBody), mockParams as never)
    expect(res.status).toBe(409)
  })

  it('returns 400 if check_out is not after check_in', async () => {
    setupMocks()
    const res = await POST(makeRequest({ ...validBody, check_in: '2026-07-05', check_out: '2026-07-01' }), mockParams as never)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/after check-in/i)
  })

  it('returns 409 if room is not available for the new dates', async () => {
    setupMocks()
    ;(isRoomAvailableExcluding as jest.Mock).mockResolvedValueOnce(false)
    const res = await POST(makeRequest(validBody), mockParams as never)
    expect(res.status).toBe(409)
  })

  it('returns 200 with price_delta and request_id on success', async () => {
    setupMocks()
    const res = await POST(makeRequest(validBody), mockParams as never)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(typeof data.price_delta).toBe('number')
    expect(data.request_id).toBe('req-1')
  })
})
