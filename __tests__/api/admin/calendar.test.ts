/**
 * @jest-environment node
 */
import { GET } from '@/app/api/admin/calendar/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockUser = { id: 'user-1' }

function makeAuthMock(user: typeof mockUser | null = mockUser) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : new Error('not auth'),
      }),
    },
  }
}

function makeDbMock(overrides: Record<string, unknown> = {}) {
  const rooms = [
    { id: 'r1', name: 'Room 1', nightly_rate: 100, price_min: 80, price_max: 150, property: { name: 'Prop 1' } },
  ]
  const bookings = [
    { id: 'b1', room_id: 'r1', check_in: '2026-05-01', check_out: '2026-05-04', status: 'confirmed' },
  ]
  const icalBlocks: unknown[] = []
  const dateOverrides: unknown[] = []
  const tasks: unknown[] = []

  const makeQuery = (data: unknown[]) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: overrides[data as unknown as string] ?? data, error: null }),
  })

  return {
    from: jest.fn((table: string) => {
      if (table === 'rooms') return makeQuery(rooms)
      if (table === 'bookings') return makeQuery(bookings)
      if (table === 'ical_blocks') return makeQuery(icalBlocks)
      if (table === 'date_overrides') return makeQuery(dateOverrides)
      if (table === 'calendar_tasks') return makeQuery(tasks)
      return makeQuery([])
    }),
  }
}

describe('GET /api/admin/calendar', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock(null))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const req = new NextRequest('http://localhost/api/admin/calendar?from=2026-05-01&to=2026-05-31')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when from/to params are missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const req = new NextRequest('http://localhost/api/admin/calendar')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns calendar data shape when authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const req = new NextRequest('http://localhost/api/admin/calendar?from=2026-05-01&to=2026-05-31')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('rooms')
    expect(body).toHaveProperty('bookings')
    expect(body).toHaveProperty('icalBlocks')
    expect(body).toHaveProperty('dateOverrides')
    expect(body).toHaveProperty('tasks')
    expect(Array.isArray(body.rooms)).toBe(true)
  })
})
