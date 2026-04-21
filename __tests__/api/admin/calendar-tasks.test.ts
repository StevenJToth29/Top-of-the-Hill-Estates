/**
 * @jest-environment node
 */
import { POST } from '@/app/api/admin/calendar-tasks/route'
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

function makeDbMock(insertError: Error | null = null) {
  const single = jest.fn().mockResolvedValue({
    data: { id: 'task-1', title: 'Clean Room', due_date: '2026-05-01', status: 'pending' },
    error: insertError,
  })
  const select = jest.fn().mockReturnValue({ single })
  const insert = jest.fn().mockReturnValue({ select })
  const from = jest.fn().mockReturnValue({ insert })
  return { from, insert, select, single }
}

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/admin/calendar-tasks', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/admin/calendar-tasks', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock(null))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await POST(makeReq({ title: 'Test', due_date: '2026-05-01' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when title is missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await POST(makeReq({ due_date: '2026-05-01' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when due_date is missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await POST(makeReq({ title: 'Clean Room' }))
    expect(res.status).toBe(400)
  })

  it('creates a task and returns 201', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await POST(makeReq({ title: 'Clean Room', due_date: '2026-05-01' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.task.title).toBe('Clean Room')
  })
})
