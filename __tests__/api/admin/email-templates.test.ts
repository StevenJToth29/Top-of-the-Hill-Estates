/**
 * @jest-environment node
 */
import { GET as LIST, POST } from '@/app/api/admin/email/templates/route'
import { GET, PUT, DELETE } from '@/app/api/admin/email/templates/[id]/route'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

const mockServerClient = createServerSupabaseClient as jest.Mock
const mockServiceClient = createServiceRoleClient as jest.Mock

const authedUser = { id: 'user-1' }

function mockAuth(user: typeof authedUser | null) {
  mockServerClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  })
}

const mockTemplate = {
  id: 't-1',
  name: 'Booking Confirmation',
  subject: 'Your booking is confirmed',
  body: '<p>Hello {{guest_first_name}}</p>',
  is_active: true,
  created_at: '2026-04-20T00:00:00Z',
  updated_at: '2026-04-20T00:00:00Z',
}

describe('GET /api/admin/email/templates', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth(null)
    const res = await LIST()
    expect(res.status).toBe(401)
  })

  it('returns template list', async () => {
    mockAuth(authedUser)
    const order = jest.fn().mockResolvedValue({ data: [mockTemplate], error: null })
    const select = jest.fn().mockReturnValue({ order })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) })
    const res = await LIST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })
})

describe('POST /api/admin/email/templates', () => {
  it('creates a template', async () => {
    mockAuth(authedUser)
    const single = jest.fn().mockResolvedValue({ data: mockTemplate, error: null })
    const select = jest.fn().mockReturnValue({ single })
    const insert = jest.fn().mockReturnValue({ select })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ insert }) })
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Booking Confirmation', subject: 'Confirmed', body: '<p>Hi</p>' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(201)
  })
})

describe('PUT /api/admin/email/templates/[id]', () => {
  it('updates a template', async () => {
    mockAuth(authedUser)
    const single = jest.fn().mockResolvedValue({ data: mockTemplate, error: null })
    const selectFn = jest.fn().mockReturnValue({ single })
    const eq = jest.fn().mockReturnValue({ select: selectFn })
    const update = jest.fn().mockReturnValue({ eq })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ update }) })
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PUT(req as never, { params: { id: 't-1' } })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/admin/email/templates/[id]', () => {
  it('deletes a template', async () => {
    mockAuth(authedUser)
    const eq = jest.fn().mockResolvedValue({ error: null })
    const deleteFn = jest.fn().mockReturnValue({ eq })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ delete: deleteFn }) })
    const res = await DELETE(new Request('http://localhost') as never, { params: { id: 't-1' } })
    expect(res.status).toBe(200)
  })
})
