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

  const makeQuery = (data: unknown[]) => {
    const resolved = { data: overrides[data as unknown as string] ?? data, error: null }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      or: jest.fn().mockResolvedValue(resolved),
      order: jest.fn().mockResolvedValue(resolved),
    }
  }

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

function makeDbMockWithExceptions(tasks: unknown[], exceptions: unknown[]) {
  const rooms = [
    { id: 'r1', name: 'Room 1', nightly_rate: 100, price_min: 80, price_max: 150, property: { name: 'Prop 1' } },
  ]
  const bookings = [
    { id: 'b1', room_id: 'r1', check_in: '2026-05-01', check_out: '2026-05-04', status: 'confirmed' },
  ]

  // Build a chainable query stub that also acts as a thenable (resolves with data).
  // Every method returns the same stub so chaining works; awaiting the stub itself
  // yields { data, error: null }.
  const makeQuery = (data: unknown[]) => {
    const resolved = { data, error: null }
    const stub: Record<string, unknown> = {}
    const chainFn = jest.fn().mockReturnValue(stub)
    stub.select = chainFn
    stub.eq = chainFn
    stub.in = chainFn
    stub.gte = chainFn
    stub.lte = chainFn
    stub.lt = chainFn
    stub.or = jest.fn().mockResolvedValue(resolved)
    stub.order = jest.fn().mockResolvedValue(resolved)
    // Make the stub itself thenable so `await stub` works
    stub.then = (resolve: (v: unknown) => void) => Promise.resolve(resolved).then(resolve)
    return stub
  }

  return {
    from: jest.fn((table: string) => {
      if (table === 'rooms') return makeQuery(rooms)
      if (table === 'bookings') return makeQuery(bookings)
      if (table === 'ical_blocks') return makeQuery([])
      if (table === 'date_overrides') return makeQuery([])
      if (table === 'calendar_tasks') return makeQuery(tasks)
      if (table === 'task_exceptions') return makeQuery(exceptions)
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

  it('returns calendar data with tasks array', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const req = new NextRequest('http://localhost/api/admin/calendar?from=2026-05-01&to=2026-05-31')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.tasks)).toBe(true)
  })

  it('filters out deleted occurrences based on task_exceptions', async () => {
    const recurringTask = {
      id: 'task-1',
      title: 'Weekly clean',
      due_date: '2026-05-01',
      recurrence_rule: 'FREQ=WEEKLY',
      recurrence_end_date: null,
      status: 'pending',
      color: '#3B82F6',
      description: null,
      room_id: null,
      assigned_to: null,
      created_at: '2026-01-01T00:00:00Z',
      occurrence_date: null,
      is_recurring: null,
    }
    const exception = {
      id: 'exc-1',
      task_id: 'task-1',
      occurrence_date: '2026-05-08',
      is_deleted: true,
      status: null,
      title: null,
      color: null,
      description: null,
      created_at: '2026-01-01T00:00:00Z',
    }

    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(
      makeDbMockWithExceptions([recurringTask], [exception]),
    )

    const req = new NextRequest('http://localhost/api/admin/calendar?from=2026-05-01&to=2026-05-31')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    const dates = body.tasks.map((t: { due_date: string }) => t.due_date)
    expect(dates).toContain('2026-05-01')
    expect(dates).not.toContain('2026-05-08')
  })

  it('applies exception field overrides to recurring occurrences', async () => {
    const recurringTask = {
      id: 'task-2',
      title: 'Weekly clean',
      due_date: '2026-05-01',
      recurrence_rule: 'FREQ=WEEKLY',
      recurrence_end_date: null,
      status: 'pending',
      color: '#3B82F6',
      description: null,
      room_id: null,
      assigned_to: null,
      created_at: '2026-01-01T00:00:00Z',
      occurrence_date: null,
      is_recurring: null,
    }
    const exception = {
      id: 'exc-2',
      task_id: 'task-2',
      occurrence_date: '2026-05-08',
      is_deleted: false,
      status: 'complete',
      title: 'Deep clean',
      color: '#EF4444',
      description: 'Extra thorough this week',
      created_at: '2026-01-01T00:00:00Z',
    }

    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(
      makeDbMockWithExceptions([recurringTask], [exception]),
    )

    const req = new NextRequest('http://localhost/api/admin/calendar?from=2026-05-01&to=2026-05-31')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    const occ = body.tasks.find((t: { due_date: string }) => t.due_date === '2026-05-08')
    expect(occ).toBeDefined()
    expect(occ.status).toBe('complete')
    expect(occ.title).toBe('Deep clean')
    expect(occ.color).toBe('#EF4444')
    expect(occ.is_recurring).toBe(true)
    expect(occ.occurrence_date).toBe('2026-05-08')
  })
})
