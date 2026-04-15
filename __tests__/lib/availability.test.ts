/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import { isRoomAvailableExcluding } from '@/lib/availability'

function mockSupabase(bookings: { check_in: string; check_out: string }[] = []) {
  const makeChain = (resolveValue: unknown) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockResolvedValue(resolveValue),
  })

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'bookings') return makeChain({ data: bookings, error: null })
      return makeChain({ data: [], error: null }) // ical_blocks
    }),
  })
}

describe('isRoomAvailableExcluding', () => {
  it('returns true when no other bookings overlap', async () => {
    mockSupabase([])
    const result = await isRoomAvailableExcluding('room-1', '2026-06-10', '2026-06-15', 'excl-id')
    expect(result).toBe(true)
  })

  it('returns false when another booking overlaps', async () => {
    mockSupabase([{ check_in: '2026-06-12', check_out: '2026-06-17' }])
    const result = await isRoomAvailableExcluding('room-1', '2026-06-10', '2026-06-15', 'excl-id')
    expect(result).toBe(false)
  })

  it('returns true when the only overlapping booking is the excluded one (mock returns empty)', async () => {
    // The DB query already filters out the excluded booking via .neq('id', excludeBookingId)
    // Simulated by mock returning empty array
    mockSupabase([])
    const result = await isRoomAvailableExcluding('room-1', '2026-06-10', '2026-06-15', 'booking-being-modified')
    expect(result).toBe(true)
  })
})
