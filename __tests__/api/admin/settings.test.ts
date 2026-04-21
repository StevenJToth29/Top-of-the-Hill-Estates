/**
 * @jest-environment node
 */
import { PATCH } from '@/app/api/admin/settings/route'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

const mockCreateServerClient = createServerSupabaseClient as jest.Mock
const mockCreateServiceClient = createServiceRoleClient as jest.Mock

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Creates a fresh Supabase query-builder mock chain for each test.
 * Returns handles on each link so individual tests can assert on calls.
 */
function createDbMocks(opts: { updateError?: unknown; insertError?: unknown } = {}) {
  const eq = jest.fn().mockResolvedValue({ error: opts.updateError ?? null })
  const update = jest.fn().mockReturnValue({ eq })
  const single = jest.fn().mockResolvedValue({ error: opts.insertError ?? null })
  const select = jest.fn().mockReturnValue({ single })
  const insert = jest.fn().mockReturnValue({ select })
  const from = jest.fn().mockReturnValue({ update, insert })
  return { from, update, eq, insert, select, single }
}

const authedUser = { id: 'user-1', email: 'admin@test.com' }

const defaultBody = {
  id: 'settings-1',
  business_name: 'Test Business',
  about_text: 'About us',
  contact_phone: '(555) 123-4567',
  contact_email: 'info@test.com',
  contact_address: '123 Main St',
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  const db = createDbMocks()
  mockCreateServerClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: authedUser }, error: null }),
    },
  })
  mockCreateServiceClient.mockReturnValue({ from: db.from })
})

afterEach(() => {
  jest.resetAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PATCH /api/admin/settings – authentication', () => {
  test('returns 401 when getUser returns an auth error', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: { user: null }, error: new Error('JWT expired') }),
      },
    })
    const res = await PATCH(makeRequest(defaultBody))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  test('returns 401 when user is null but no auth error', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    const res = await PATCH(makeRequest(defaultBody))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })
})

describe('PATCH /api/admin/settings – update vs insert', () => {
  test('calls update when body contains an id', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest(defaultBody))

    expect(db.from).toHaveBeenCalledWith('site_settings')
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ business_name: 'Test Business' }),
    )
    expect(db.eq).toHaveBeenCalledWith('id', 'settings-1')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  test('calls insert when body has no id', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const bodyWithoutId = { ...defaultBody, id: undefined }
    const res = await PATCH(makeRequest(bodyWithoutId))

    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({ business_name: 'Test Business' }),
    )
    expect(db.update).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/admin/settings – error handling', () => {
  test('returns 500 with error message when DB update fails', async () => {
    const db = createDbMocks({ updateError: { message: 'unique constraint violation' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const res = await PATCH(makeRequest(defaultBody))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'unique constraint violation' })
  })

  test('returns 500 with error message when DB insert fails', async () => {
    const db = createDbMocks({ insertError: { message: 'insert failed' } })
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const bodyWithoutId = { ...defaultBody, id: undefined }
    const res = await PATCH(makeRequest(bodyWithoutId))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'insert failed' })
  })
})

describe('PATCH /api/admin/settings – field handling', () => {
  test('always sets updated_at to an ISO string', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest(defaultBody))

    const fields = db.update.mock.calls[0][0]
    expect(fields.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('always sends core text fields', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest(defaultBody))

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        about_text: 'About us',
        contact_phone: '(555) 123-4567',
        contact_email: 'info@test.com',
        contact_address: '123 Main St',
      }),
    )
  })

  test('includes logo_url when present in body', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest({ ...defaultBody, logo_url: 'https://cdn.example.com/logo.png' }))

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ logo_url: 'https://cdn.example.com/logo.png' }),
    )
  })

  test('omits logo_url when not present in body', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest(defaultBody))

    const fields = db.update.mock.calls[0][0]
    expect(fields).not.toHaveProperty('logo_url')
  })

  test('includes logo_size when present in body', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest({ ...defaultBody, logo_size: 64 }))

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ logo_size: 64 }),
    )
  })

  test('omits logo_size when not present in body', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest(defaultBody))

    const fields = db.update.mock.calls[0][0]
    expect(fields).not.toHaveProperty('logo_size')
  })

  test('includes business_hours when present in body', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    const hours = JSON.stringify({ Mon: { open: '09:00', close: '17:00', closed: false } })
    await PATCH(makeRequest({ ...defaultBody, business_hours: hours }))

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ business_hours: hours }),
    )
  })

  test('omits business_hours when not present in body', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest(defaultBody))

    const fields = db.update.mock.calls[0][0]
    expect(fields).not.toHaveProperty('business_hours')
  })

  test('includes favicon_url when present in body', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest({ ...defaultBody, favicon_url: 'https://cdn.example.com/favicon/32.png' }))

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ favicon_url: 'https://cdn.example.com/favicon/32.png' }),
    )
  })

  test('omits favicon_url when not present in body', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest(defaultBody))

    const fields = db.update.mock.calls[0][0]
    expect(fields).not.toHaveProperty('favicon_url')
  })

  test('includes favicon_large_url when present in body', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest({ ...defaultBody, favicon_large_url: 'https://cdn.example.com/favicon/192.png' }))

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ favicon_large_url: 'https://cdn.example.com/favicon/192.png' }),
    )
  })

  test('omits favicon_large_url when not present in body', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest(defaultBody))

    const fields = db.update.mock.calls[0][0]
    expect(fields).not.toHaveProperty('favicon_large_url')
  })

  test('includes favicon_apple_url when present in body', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest({ ...defaultBody, favicon_apple_url: 'https://cdn.example.com/favicon/180.png' }))

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ favicon_apple_url: 'https://cdn.example.com/favicon/180.png' }),
    )
  })

  test('omits favicon_apple_url when not present in body', async () => {
    const db = createDbMocks()
    mockCreateServiceClient.mockReturnValue({ from: db.from })

    await PATCH(makeRequest(defaultBody))

    const fields = db.update.mock.calls[0][0]
    expect(fields).not.toHaveProperty('favicon_apple_url')
  })
})
