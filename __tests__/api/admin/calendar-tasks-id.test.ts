/**
 * @jest-environment node
 */
import { PATCH, DELETE } from '@/app/api/admin/calendar-tasks/[id]/route'
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

function makeDbMock(updateError: Error | null = null, deleteError: Error | null = null) {
  const single = jest.fn().mockResolvedValue({
    data: updateError ? null : { id: 'task-1', title: 'Updated', status: 'complete' },
    error: updateError,
  })
  const select = jest.fn().mockReturnValue({ single })
  const eqUpdate = jest.fn().mockReturnValue({ select })
  const update = jest.fn().mockReturnValue({ eq: eqUpdate })
  const eqDelete = jest.fn().mockResolvedValue({ error: deleteError })
  const del = jest.fn().mockReturnValue({ eq: eqDelete })
  const from = jest.fn((table: string) => {
    if (table === 'calendar_tasks') return { update, delete: del }
    return {}
  })
  return { from }
}

function makeReq(method: string, body?: unknown, id = 'task-1') {
  return new NextRequest(`http://localhost/api/admin/calendar-tasks/${id}`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
}

const params = { params: Promise.resolve({ id: 'task-1' }) }

describe('PATCH /api/admin/calendar-tasks/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock(null))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const res = await PATCH(makeReq('PATCH', { status: 'complete' }), params)
    expect(res.status).toBe(401)
  })

  it('updates the task and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const res = await PATCH(makeReq('PATCH', { status: 'complete', title: 'Updated' }), params)
    expect(res.status).toBe(200)
  })

  it('returns 500 when DB update fails', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock(new Error('DB failure')))
    const res = await PATCH(makeReq('PATCH', { status: 'complete' }), params)
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/admin/calendar-tasks/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock(null))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const res = await DELETE(makeReq('DELETE'), params)
    expect(res.status).toBe(401)
  })

  it('deletes the task and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const res = await DELETE(makeReq('DELETE'), params)
    expect(res.status).toBe(200)
  })

  it('returns 500 when DB delete fails', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock(null, new Error('DB failure')))
    const res = await DELETE(makeReq('DELETE'), params)
    expect(res.status).toBe(500)
  })
})
