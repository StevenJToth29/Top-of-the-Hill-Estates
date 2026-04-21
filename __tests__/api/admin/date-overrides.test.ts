/**
 * @jest-environment node
 */
import { PUT } from '@/app/api/admin/date-overrides/route'
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

function makeDbMock(upsertError: Error | null = null) {
  const upsert = jest.fn().mockResolvedValue({ data: [], error: upsertError })
  const from = jest.fn().mockReturnValue({ upsert })
  return { from, upsert }
}

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/admin/date-overrides', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('PUT /api/admin/date-overrides', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock(null))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await PUT(makeReq({ room_id: 'r1', dates: ['2026-05-01'], is_blocked: true }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when room_id is missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await PUT(makeReq({ dates: ['2026-05-01'], is_blocked: true }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when dates array is missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await PUT(makeReq({ room_id: 'r1', is_blocked: true }))
    expect(res.status).toBe(400)
  })

  it('upserts date overrides and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    const { from, upsert } = makeDbMock()
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from })

    const res = await PUT(makeReq({
      room_id: 'r1',
      dates: ['2026-05-01', '2026-05-02'],
      is_blocked: true,
      block_reason: 'Maintenance',
    }))
    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledTimes(1)
    const upsertArg = upsert.mock.calls[0][0] as unknown[]
    expect(upsertArg).toHaveLength(2)
  })

  it('returns 200 for unblock operation (is_blocked false)', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await PUT(makeReq({
      room_id: 'r1',
      dates: ['2026-05-01'],
      is_blocked: false,
    }))
    expect(res.status).toBe(200)
  })

  it('returns 500 when DB upsert fails', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock(new Error('DB failure')))
    const res = await PUT(makeReq({ room_id: 'r1', dates: ['2026-05-01'], is_blocked: true }))
    expect(res.status).toBe(500)
  })
})
