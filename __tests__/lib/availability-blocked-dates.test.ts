/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import { getBlockedDatesForRoom, isRoomAvailable, getAvailableRoomIds } from '@/lib/availability'

function mockSupabase(
  bookings: { check_in: string; check_out: string; room_id?: string }[] = [],
  icalBlocks: { start_date: string; end_date: string; room_id?: string }[] = [],
) {
  const makeBookingChain = (rows: unknown[]) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockResolvedValue({ data: rows, error: null }),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: rows.slice(-1), error: null }),
  })

  const makeIcalChain = (rows: unknown[]) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockResolvedValue({ data: rows, error: null }),
  })

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'bookings') return makeBookingChain(bookings)
      if (table === 'ical_blocks') return makeIcalChain(icalBlocks)
      return makeIcalChain([])
    }),
  })
}

describe('getBlockedDatesForRoom', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns empty array when no bookings or iCal blocks exist', async () => {
    mockSupabase([], [])
    const result = await getBlockedDatesForRoom('room-1', '2026-06-01', '2026-06-30')
    expect(result).toEqual([])
  })

  it('returns blocked dates from a confirmed booking', async () => {
    mockSupabase([{ check_in: '2026-06-10', check_out: '2026-06-13' }])
    const result = await getBlockedDatesForRoom('room-1', '2026-06-01', '2026-06-30')
    expect(result).toEqual(['2026-06-10', '2026-06-11', '2026-06-12'])
  })

  it('does NOT include the checkout date (checkout day is the first free day for next guest)', async () => {
    mockSupabase([{ check_in: '2026-06-10', check_out: '2026-06-12' }])
    const result = await getBlockedDatesForRoom('room-1', '2026-06-01', '2026-06-30')
    expect(result).not.toContain('2026-06-12')
    expect(result).toContain('2026-06-10')
    expect(result).toContain('2026-06-11')
  })

  it('returns blocked dates from an iCal block', async () => {
    mockSupabase([], [{ start_date: '2026-06-20', end_date: '2026-06-22' }])
    const result = await getBlockedDatesForRoom('room-1', '2026-06-01', '2026-06-30')
    expect(result).toEqual(['2026-06-20', '2026-06-21'])
  })

  it('merges blocked dates from both bookings and iCal blocks without duplicates', async () => {
    mockSupabase(
      [{ check_in: '2026-06-10', check_out: '2026-06-12' }],
      [{ start_date: '2026-06-11', end_date: '2026-06-14' }],
    )
    const result = await getBlockedDatesForRoom('room-1', '2026-06-01', '2026-06-30')
    // 2026-06-11 appears in both — should not be duplicated
    expect(result).toEqual(['2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13'])
  })

  it('returns dates sorted ascending', async () => {
    mockSupabase([
      { check_in: '2026-06-20', check_out: '2026-06-22' },
      { check_in: '2026-06-05', check_out: '2026-06-07' },
    ])
    const result = await getBlockedDatesForRoom('room-1', '2026-06-01', '2026-06-30')
    expect(result).toEqual(['2026-06-05', '2026-06-06', '2026-06-20', '2026-06-21'])
  })
})

describe('isRoomAvailable', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns true when the room has no bookings', async () => {
    mockSupabase([], [])
    const result = await isRoomAvailable('room-1', '2026-07-01', '2026-07-05')
    expect(result).toBe(true)
  })

  it('returns false when a booking fully overlaps the requested dates', async () => {
    mockSupabase([{ check_in: '2026-07-01', check_out: '2026-07-10' }])
    const result = await isRoomAvailable('room-1', '2026-07-03', '2026-07-06')
    expect(result).toBe(false)
  })

  it('returns false when a booking partially overlaps (starts before, ends during)', async () => {
    mockSupabase([{ check_in: '2026-06-28', check_out: '2026-07-03' }])
    const result = await isRoomAvailable('room-1', '2026-07-01', '2026-07-05')
    expect(result).toBe(false)
  })

  it('returns true when an existing booking ends exactly on the new check-in (back-to-back stays)', async () => {
    // Booking ends 2026-07-01 — checkout day is free so new guest can check in same day
    mockSupabase([{ check_in: '2026-06-28', check_out: '2026-07-01' }])
    const result = await isRoomAvailable('room-1', '2026-07-01', '2026-07-05')
    expect(result).toBe(true)
  })

  it('returns false when an iCal block covers the requested dates', async () => {
    mockSupabase([], [{ start_date: '2026-07-02', end_date: '2026-07-08' }])
    const result = await isRoomAvailable('room-1', '2026-07-01', '2026-07-05')
    expect(result).toBe(false)
  })
})

describe('getAvailableRoomIds', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns all room IDs when no bookings exist', async () => {
    // Mock both bookings and ical_blocks to return empty
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })
    const result = await getAvailableRoomIds(['room-1', 'room-2'], '2026-07-01', '2026-07-05')
    expect(result).toEqual(new Set(['room-1', 'room-2']))
  })

  it('excludes rooms that have a conflicting booking', async () => {
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({
          data:
            table === 'bookings'
              ? [{ room_id: 'room-1', check_in: '2026-07-02', check_out: '2026-07-06' }]
              : [],
          error: null,
        }),
      })),
    })
    const result = await getAvailableRoomIds(['room-1', 'room-2'], '2026-07-01', '2026-07-05')
    expect(result.has('room-1')).toBe(false)
    expect(result.has('room-2')).toBe(true)
  })

  it('returns empty set when roomIds is empty', async () => {
    const result = await getAvailableRoomIds([], '2026-07-01', '2026-07-05')
    expect(result).toEqual(new Set())
    expect(createServiceRoleClient).not.toHaveBeenCalled()
  })
})
