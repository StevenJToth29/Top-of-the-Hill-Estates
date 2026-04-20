/**
 * @jest-environment node
 */
import { GET as LIST, POST } from '@/app/api/admin/email/automations/route'
import { GET, PUT, DELETE } from '@/app/api/admin/email/automations/[id]/route'
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

const mockAutomation = {
  id: 'a-1',
  name: 'Booking Confirmed',
  trigger_event: 'booking_confirmed',
  is_active: true,
  delay_minutes: 0,
  conditions: { operator: 'AND', rules: [] },
  template_id: 't-1',
  recipient_type: 'guest',
  is_pre_planned: true,
  created_at: '2026-04-20T00:00:00Z',
  updated_at: '2026-04-20T00:00:00Z',
}

describe('GET /api/admin/email/automations', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth(null)
    const res = await LIST()
    expect(res.status).toBe(401)
  })

  it('returns automation list', async () => {
    mockAuth(authedUser)
    const order2 = jest.fn().mockResolvedValue({ data: [mockAutomation], error: null })
    const order1 = jest.fn().mockReturnValue({ order: order2 })
    const select = jest.fn().mockReturnValue({ order: order1 })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) })
    const res = await LIST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })
})

describe('POST /api/admin/email/automations', () => {
  it('creates a custom automation', async () => {
    mockAuth(authedUser)
    const single = jest.fn().mockResolvedValue({ data: { ...mockAutomation, is_pre_planned: false }, error: null })
    const select = jest.fn().mockReturnValue({ single })
    const insert = jest.fn().mockReturnValue({ select })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ insert }) })
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Custom', trigger_event: 'booking_confirmed', delay_minutes: 60 }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(201)
  })
})

describe('PUT /api/admin/email/automations/[id]', () => {
  it('updates an automation', async () => {
    mockAuth(authedUser)
    const single = jest.fn().mockResolvedValue({ data: mockAutomation, error: null })
    const selectFn = jest.fn().mockReturnValue({ single })
    const eq = jest.fn().mockReturnValue({ select: selectFn })
    const update = jest.fn().mockReturnValue({ eq })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ update }) })
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ is_active: false }),
    })
    const res = await PUT(req as never, { params: { id: 'a-1' } })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/admin/email/automations/[id]', () => {
  it('refuses to delete pre-planned automations', async () => {
    mockAuth(authedUser)
    const single = jest.fn().mockResolvedValue({ data: { is_pre_planned: true }, error: null })
    const eq = jest.fn().mockReturnValue({ single })
    const select = jest.fn().mockReturnValue({ eq })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) })
    const res = await DELETE(new Request('http://localhost') as never, { params: { id: 'a-1' } })
    expect(res.status).toBe(403)
  })

  it('deletes a custom automation', async () => {
    mockAuth(authedUser)
    const eqDel = jest.fn().mockResolvedValue({ error: null })
    const deleteFn = jest.fn().mockReturnValue({ eq: eqDel })
    const eqSel = jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { is_pre_planned: false }, error: null }) })
    const select = jest.fn().mockReturnValue({ eq: eqSel })
    mockServiceClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select, delete: deleteFn }),
    })
    const res = await DELETE(new Request('http://localhost') as never, { params: { id: 'a-2' } })
    expect(res.status).toBe(200)
  })
})
