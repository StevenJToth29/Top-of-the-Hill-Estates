/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/admin/task-automations/route'
import { PATCH, DELETE } from '@/app/api/admin/task-automations/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockUser = { id: 'user-1' }
function makeAuth() {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) } }
}
function makeAuthFail() {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error('fail') }) } }
}

const autoRow = {
  id: 'auto-1', scope_type: 'global', room_id: null, property_id: null,
  trigger_event: 'checkout', title: 'Clean', description: null,
  day_offset: 0, color: null, assignee_id: null, is_active: true,
  created_at: '', updated_at: '',
}

function makeDb() {
  const single = jest.fn().mockResolvedValue({ data: autoRow, error: null })
  const select = jest.fn().mockReturnValue({
    order: jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({ data: [autoRow], error: null }),
    }),
    single,
  })
  const insert = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) })
  const eqUpdate = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) })
  const update = jest.fn().mockReturnValue({ eq: eqUpdate })
  const eqDelete = jest.fn().mockResolvedValue({ error: null })
  const del = jest.fn().mockReturnValue({ eq: eqDelete })
  return { from: jest.fn().mockReturnValue({ select, insert, update, delete: del }) }
}

const idParams = { params: Promise.resolve({ id: 'auto-1' }) }

describe('GET /api/admin/task-automations', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthFail())
    const res = await GET()
    expect(res.status).toBe(401)
  })
  it('returns list', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

describe('POST /api/admin/task-automations', () => {
  it('returns 400 when required fields missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/task-automations', {
      method: 'POST', body: JSON.stringify({ scope_type: 'global' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
  it('creates automation and returns 201', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/task-automations', {
      method: 'POST',
      body: JSON.stringify({ scope_type: 'global', trigger_event: 'checkout', title: 'Clean', day_offset: 0 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

describe('PATCH /api/admin/task-automations/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthFail())
    const req = new NextRequest('http://localhost/api/admin/task-automations/auto-1', {
      method: 'PATCH', body: JSON.stringify({ is_active: false }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, idParams)
    expect(res.status).toBe(401)
  })
  it('updates and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/task-automations/auto-1', {
      method: 'PATCH', body: JSON.stringify({ is_active: false }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, idParams)
    expect(res.status).toBe(200)
  })
  it('returns 404 when automation not found', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Row not found' },
              }),
            }),
          }),
        }),
      }),
    })
    const req = new NextRequest('http://localhost/api/admin/task-automations/missing', {
      method: 'PATCH', body: JSON.stringify({ is_active: false }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/admin/task-automations/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthFail())
    const req = new NextRequest('http://localhost/api/admin/task-automations/auto-1', { method: 'DELETE' })
    const res = await DELETE(req, idParams)
    expect(res.status).toBe(401)
  })
  it('deletes and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/task-automations/auto-1', { method: 'DELETE' })
    const res = await DELETE(req, idParams)
    expect(res.status).toBe(200)
  })
})
