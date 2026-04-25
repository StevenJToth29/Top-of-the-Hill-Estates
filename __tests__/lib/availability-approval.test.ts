// __tests__/lib/availability-approval.test.ts
/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import { getBlockedDatesForRoom, isRoomAvailable, getAvailableRoomIds } from '@/lib/availability'

function mockSupabase(bookings: { check_in: string; check_out: string }[]) {
  const makeChain = (resolveValue: unknown) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockResolvedValue(resolveValue),
  })
  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'bookings') return makeChain({ data: bookings, error: null })
      return makeChain({ data: [], error: null })
    }),
  })
}

describe('availability with approval statuses', () => {
  beforeEach(() => jest.clearAllMocks())

  it('blocks dates for pending_docs booking', async () => {
    mockSupabase([{ check_in: '2026-07-01', check_out: '2026-07-05' }])
    const blocked = await getBlockedDatesForRoom('room-1', '2026-06-01', '2026-08-01')
    expect(blocked).toContain('2026-07-01')
    expect(blocked).toContain('2026-07-04')
    expect(blocked).not.toContain('2026-07-05')
  })

  it('blocks dates for under_review booking', async () => {
    mockSupabase([{ check_in: '2026-07-10', check_out: '2026-07-12' }])
    const result = await isRoomAvailable('room-1', '2026-07-09', '2026-07-11')
    expect(result).toBe(false)
  })

  it('isRoomAvailable returns true when no overlap', async () => {
    mockSupabase([{ check_in: '2026-07-01', check_out: '2026-07-05' }])
    const result = await isRoomAvailable('room-1', '2026-07-06', '2026-07-10')
    expect(result).toBe(true)
  })
})
