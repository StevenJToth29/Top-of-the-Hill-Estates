/**
 * @jest-environment node
 */
import { PATCH, DELETE } from '@/app/api/admin/calendar-tasks/[id]/occurrences/[date]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockUser = { id: 'user-1' }

function makeAuthMock(user = mockUser) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  }
}

const baseTask = {
  id: 'task-1',
  title: 'Weekly clean',
  due_date: '2026-05-01',
  recurrence_rule: 'FREQ=WEEKLY',
  recurrence_end_date: null,
  description: null,
  room_id: null,
  property_id: null,
  status: 'pending',
  color: '#6366F1',
  series_id: 'task-1',
  occurrence_date: null,
  is_recurring: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
}

const exceptionRow = {
  id: 'exc-1',
  task_id: 'task-1',
  occurrence_date: '2026-05-08',
  is_deleted: false,
  status: 'complete',
  title: null,
  color: null,
  description: null,
  created_at: '2026-05-08T00:00:00Z',
}

function makeDbMock() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'task_exceptions') {
        return {
          upsert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: exceptionRow, error: null }),
        }
      }
      if (table === 'calendar_tasks') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: baseTask, error: null }),
        }
      }
      return {}
    }),
  }
}

const params = Promise.resolve({ id: 'task-1', date: '2026-05-08' })

describe('PATCH /api/admin/calendar-tasks/[id]/occurrences/[date]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(
      makeAuthMock(null as unknown as typeof mockUser),
    )
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const req = new NextRequest(
      'http://localhost/api/admin/calendar-tasks/task-1/occurrences/2026-05-08',
      { method: 'PATCH', body: JSON.stringify({ status: 'complete' }), headers: { 'Content-Type': 'application/json' } },
    )
    const res = await PATCH(req, { params })
    expect(res.status).toBe(401)
  })

  it('upserts the exception and returns the merged task occurrence', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const req = new NextRequest(
      'http://localhost/api/admin/calendar-tasks/task-1/occurrences/2026-05-08',
      { method: 'PATCH', body: JSON.stringify({ status: 'complete' }), headers: { 'Content-Type': 'application/json' } },
    )
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.task.due_date).toBe('2026-05-08')
    expect(body.task.status).toBe('complete')
    expect(body.task.is_recurring).toBe(true)
    expect(body.task.occurrence_date).toBe('2026-05-08')
  })
})

describe('DELETE /api/admin/calendar-tasks/[id]/occurrences/[date]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(
      makeAuthMock(null as unknown as typeof mockUser),
    )
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const req = new NextRequest(
      'http://localhost/api/admin/calendar-tasks/task-1/occurrences/2026-05-08',
      { method: 'DELETE' },
    )
    const res = await DELETE(req, { params })
    expect(res.status).toBe(401)
  })

  it('marks the occurrence as deleted and returns 204', async () => {
    const deletedExcRow = { ...exceptionRow, is_deleted: true }
    const dbMock = {
      from: jest.fn(() => ({
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: deletedExcRow, error: null }),
      })),
    }
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(dbMock)
    const req = new NextRequest(
      'http://localhost/api/admin/calendar-tasks/task-1/occurrences/2026-05-08',
      { method: 'DELETE' },
    )
    const res = await DELETE(req, { params })
    expect(res.status).toBe(204)
  })
})
