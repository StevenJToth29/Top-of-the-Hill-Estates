/**
 * @jest-environment node
 */
import { GET, PUT } from '@/app/api/admin/email/settings/route'
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

const mockSettings = {
  id: 'es-1',
  from_name: 'TOTH',
  from_email: 'noreply@example.com',
  admin_recipients: ['admin@example.com'],
  review_url: 'https://g.page/review',
}

describe('GET /api/admin/email/settings', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns settings when authenticated', async () => {
    mockAuth(authedUser)
    const maybeSingle = jest.fn().mockResolvedValue({ data: mockSettings, error: null })
    const select = jest.fn().mockReturnValue({ maybeSingle })
    const from = jest.fn().mockReturnValue({ select })
    mockServiceClient.mockReturnValue({ from })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.from_name).toBe('TOTH')
  })
})

describe('PUT /api/admin/email/settings', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(null)
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({}),
    })
    const res = await PUT(req as never)
    expect(res.status).toBe(401)
  })

  it('updates existing settings row', async () => {
    mockAuth(authedUser)
    const selectForId = jest.fn().mockReturnValue({ maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'es-1' }, error: null }) })
    const eqUpdate = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: mockSettings, error: null }) }) })
    const updateFn = jest.fn().mockReturnValue({ eq: eqUpdate })
    const from = jest.fn().mockImplementation((table: string) => {
      if (table === 'email_settings') return { select: selectForId, update: updateFn }
      return {}
    })
    mockServiceClient.mockReturnValue({ from })

    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ from_name: 'New Name' }),
    })
    const res = await PUT(req as never)
    expect(res.status).toBe(200)
  })
})
