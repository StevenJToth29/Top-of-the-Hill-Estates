/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/admin/people/route'
import { PATCH, DELETE } from '@/app/api/admin/people/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockUser = { id: 'user-1' }
function makeAuth(user = mockUser) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) } }
}
function makeAuthFail() {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error('no auth') }) } }
}

const personRow = { id: 'person-1', name: 'Alice', ical_token: 'tok-1', created_at: '', updated_at: '' }

function makeDb(overrides: Record<string, unknown> = {}) {
  const single = jest.fn().mockResolvedValue({ data: personRow, error: null })
  const select = jest.fn().mockReturnValue({ order: jest.fn().mockResolvedValue({ data: [personRow], error: null }), single })
  const insert = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) })
  const eqUpdate = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) })
  const update = jest.fn().mockReturnValue({ eq: eqUpdate })
  const eqDelete = jest.fn().mockResolvedValue({ error: null })
  const del = jest.fn().mockReturnValue({ eq: eqDelete })
  return { from: jest.fn().mockReturnValue({ select, insert, update, delete: del }), ...overrides }
}

const idParams = { params: Promise.resolve({ id: 'person-1' }) }

describe('GET /api/admin/people', () => {
  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthFail())
    const res = await GET()
    expect(res.status).toBe(401)
  })
  it('returns list of people', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([personRow])
  })
})

describe('POST /api/admin/people', () => {
  it('returns 400 when name is missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/people', {
      method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
  it('creates a person and returns 201', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/people', {
      method: 'POST', body: JSON.stringify({ name: 'Alice' }), headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

describe('PATCH /api/admin/people/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthFail())
    const req = new NextRequest('http://localhost/api/admin/people/person-1', {
      method: 'PATCH', body: JSON.stringify({ name: 'Bob' }), headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, idParams)
    expect(res.status).toBe(401)
  })
  it('updates and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/people/person-1', {
      method: 'PATCH', body: JSON.stringify({ name: 'Bob' }), headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, idParams)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/admin/people/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthFail())
    const req = new NextRequest('http://localhost/api/admin/people/person-1', { method: 'DELETE' })
    const res = await DELETE(req, idParams)
    expect(res.status).toBe(401)
  })
  it('deletes and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/people/person-1', { method: 'DELETE' })
    const res = await DELETE(req, idParams)
    expect(res.status).toBe(200)
  })
})
