/**
 * @jest-environment node
 */
import { POST } from '@/app/api/admin/stripe/account-session/route'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

jest.mock('@/lib/stripe', () => ({
  stripe: {
    accountSessions: { create: jest.fn() },
  },
}))

const mockCreateServerClient = createServerSupabaseClient as jest.Mock
const mockCreateServiceClient = createServiceRoleClient as jest.Mock
const mockAccountSessions = stripe.accountSessions.create as jest.Mock
const authedUser = { id: 'user-1', email: 'admin@test.com' }

function makePostRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/stripe/account-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockCreateServerClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: authedUser }, error: null }) },
  })
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('POST /api/admin/stripe/account-session', () => {
  test('returns 401 when not authenticated', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const res = await POST(makePostRequest({ account_id: 'acc-uuid-1' }))
    expect(res.status).toBe(401)
  })

  test('returns 400 when account_id is missing', async () => {
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
  })

  test('returns 404 when account not found in DB', async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const eq = jest.fn().mockReturnValue({ single })
    const select = jest.fn().mockReturnValue({ eq })
    const from = jest.fn().mockReturnValue({ select })
    mockCreateServiceClient.mockReturnValue({ from })

    const res = await POST(makePostRequest({ account_id: 'acc-uuid-1' }))
    expect(res.status).toBe(404)
  })

  test('returns client_secret on success', async () => {
    const dbAccount = { id: 'acc-uuid-1', stripe_account_id: 'acct_test123', label: 'Test', created_at: '2026-01-01' }
    const single = jest.fn().mockResolvedValue({ data: dbAccount, error: null })
    const eq = jest.fn().mockReturnValue({ single })
    const select = jest.fn().mockReturnValue({ eq })
    const from = jest.fn().mockReturnValue({ select })
    mockCreateServiceClient.mockReturnValue({ from })

    mockAccountSessions.mockResolvedValue({ client_secret: 'acss_live_xxx' })

    const res = await POST(makePostRequest({ account_id: 'acc-uuid-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.client_secret).toBe('acss_live_xxx')
    expect(mockAccountSessions).toHaveBeenCalledWith({
      account: 'acct_test123',
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
      },
    })
  })

  test('returns 500 when Stripe call fails', async () => {
    const dbAccount = { id: 'acc-uuid-1', stripe_account_id: 'acct_test123', label: 'Test', created_at: '2026-01-01' }
    const single = jest.fn().mockResolvedValue({ data: dbAccount, error: null })
    const eq = jest.fn().mockReturnValue({ single })
    const select = jest.fn().mockReturnValue({ eq })
    const from = jest.fn().mockReturnValue({ select })
    mockCreateServiceClient.mockReturnValue({ from })

    mockAccountSessions.mockRejectedValue(new Error('Stripe error'))

    const res = await POST(makePostRequest({ account_id: 'acc-uuid-1' }))
    expect(res.status).toBe(500)
  })
})
