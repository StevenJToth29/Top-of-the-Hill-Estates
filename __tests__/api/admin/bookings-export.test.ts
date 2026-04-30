/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockGetUser = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: mockGetUser },
  })
})

function makeRequest(qs = '') {
  return new Request(`http://localhost/api/admin/bookings/export${qs}`)
}

const sampleBookings = [
  {
    id: 'b-1',
    guest_first_name: 'Jane',
    guest_last_name: 'Doe',
    guest_email: 'jane@example.com',
    room: { name: 'Room A', property: { name: 'Hill House' } },
    check_in: '2026-05-01',
    check_out: '2026-05-07',
    total_nights: 6,
    total_amount: 600,
    status: 'confirmed',
    source: 'direct',
    notes: null,
    created_at: '2026-04-01T12:00:00Z',
  },
]

function buildQueryChain(rows: unknown[]) {
  const result = { data: rows, error: null }
  const chain: Record<string, unknown> = {
    then: (resolve: (v: typeof result) => void) => resolve(result),
  }
  for (const m of ['select', 'order', 'eq', 'neq', 'gte', 'lte']) {
    chain[m] = jest.fn().mockReturnValue(chain)
  }
  return jest.fn().mockReturnValue(chain)
}

// Lazy import so mocks are set up first
let GET: (req: Request) => Promise<Response>
beforeAll(async () => {
  ;({ GET } = await import('@/app/api/admin/bookings/export/route'))
})

describe('GET /api/admin/bookings/export', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns CSV with correct column headers', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: buildQueryChain(sampleBookings) })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')
    const text = await res.text()
    expect(text).toContain('Booking ID,Guest Name,Guest Email,Room')
    expect(text).toContain('b-1')
    expect(text).toContain('Jane Doe')
    expect(text).toContain('jane@example.com')
  })

  it('wraps fields containing commas in quotes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    const booking = { ...sampleBookings[0], notes: 'Late check-in, please call' }
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: buildQueryChain([booking]) })
    const res = await GET(makeRequest())
    const text = await res.text()
    expect(text).toContain('"Late check-in, please call"')
  })

  it('sets Content-Disposition attachment header', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: buildQueryChain([]) })
    const res = await GET(makeRequest())
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="bookings-/)
  })
})
