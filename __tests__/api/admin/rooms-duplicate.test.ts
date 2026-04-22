/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { POST } from '@/app/api/admin/rooms/[id]/duplicate/route'

function mockAuthed() {
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
  })
}

function mockUnauthed() {
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      }),
    },
  })
}

const sourceRoom = {
  id: 'room-src',
  property_id: 'prop-1',
  name: 'Mountain Suite',
  slug: 'mountain-suite',
  short_description: 'A cozy suite',
  description: 'Full description',
  guest_capacity: 2,
  bedrooms: 1,
  bathrooms: 1,
  nightly_rate: 150,
  monthly_rate: 3000,
  show_nightly_rate: true,
  show_monthly_rate: false,
  minimum_nights_short_term: 2,
  minimum_nights_long_term: 30,
  is_active: true,
  amenities: ['WiFi', 'Parking'],
  images: ['img1.jpg'],
  cleaning_fee: 80,
  security_deposit: 300,
  extra_guest_fee: 20,
  cancellation_window_hours: 48,
  cancellation_policy: null,
  use_property_cancellation_policy: true,
  price_min: null,
  price_max: null,
  ical_export_token: 'old-token-uuid',
}

const sourceFees = [
  { id: 'fee-1', room_id: 'room-src', label: 'Pet fee', amount: 25, booking_type: 'both' },
]

function createDbMocks({
  roomFetchError = null,
  insertError = null,
  feesInsertError = null,
} = {}) {
  const roomSelectChain = {
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(
      roomFetchError
        ? { data: null, error: { message: roomFetchError } }
        : { data: sourceRoom, error: null }
    ),
  }
  const feesSelectChain = {
    eq: jest.fn().mockResolvedValue({ data: sourceFees, error: null }),
  }
  const insertChain = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(
      insertError
        ? { data: null, error: { message: insertError } }
        : { data: { id: 'room-new' }, error: null }
    ),
  }
  const roomsInsert = jest.fn().mockReturnValue(insertChain)
  const feesInsert = jest.fn().mockResolvedValue(
    feesInsertError ? { error: { message: feesInsertError } } : { error: null }
  )

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'rooms') return { select: jest.fn().mockReturnValue(roomSelectChain), insert: roomsInsert }
      if (table === 'room_fees') return { select: jest.fn().mockReturnValue(feesSelectChain), insert: feesInsert }
    }),
  })

  return { roomsInsert, feesInsert }
}

function makeRequest(id: string, body: object) {
  return new Request(`http://localhost/api/admin/rooms/${id}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/rooms/[id]/duplicate', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockUnauthed()
    createDbMocks()
    const res = await POST(makeRequest('room-src', { name: 'Copy' }), { params: Promise.resolve({ id: 'room-src' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when source room does not exist', async () => {
    mockAuthed()
    createDbMocks({ roomFetchError: 'Not found' })
    const res = await POST(makeRequest('bad-id', { name: 'Copy' }), { params: Promise.resolve({ id: 'bad-id' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 when name is missing or empty', async () => {
    mockAuthed()
    createDbMocks()
    const res = await POST(makeRequest('room-src', { name: '  ' }), { params: Promise.resolve({ id: 'room-src' }) })
    expect(res.status).toBe(400)
  })

  it('inserts new room with correct fields and a derived slug', async () => {
    mockAuthed()
    const { roomsInsert } = createDbMocks()
    const res = await POST(makeRequest('room-src', { name: 'Garden Cottage' }), { params: Promise.resolve({ id: 'room-src' }) })

    expect(res.status).toBe(200)
    const inserted = roomsInsert.mock.calls[0][0]
    expect(inserted.name).toBe('Garden Cottage')
    expect(inserted.slug).toBe('garden-cottage')
    expect(inserted.property_id).toBe('prop-1')
    expect(inserted.nightly_rate).toBe(150)
    expect(inserted.amenities).toEqual(['WiFi', 'Parking'])
  })

  it('does NOT copy id, ical_export_token, created_at, or updated_at from source', async () => {
    mockAuthed()
    const { roomsInsert } = createDbMocks()
    await POST(makeRequest('room-src', { name: 'New Room' }), { params: Promise.resolve({ id: 'room-src' }) })

    const inserted = roomsInsert.mock.calls[0][0]
    expect(inserted.id).toBeUndefined()
    expect(inserted.ical_export_token).not.toBe('old-token-uuid')
    expect(inserted.ical_export_token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
    expect(inserted.created_at).toBeUndefined()
    expect(inserted.updated_at).toBeUndefined()
  })

  it('copies room_fees to the new room', async () => {
    mockAuthed()
    const { feesInsert } = createDbMocks()
    await POST(makeRequest('room-src', { name: 'New Room' }), { params: Promise.resolve({ id: 'room-src' }) })

    expect(feesInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ room_id: 'room-new', label: 'Pet fee', amount: 25, booking_type: 'both' }),
      ])
    )
    const feeArg = feesInsert.mock.calls[0][0][0]
    expect(feeArg.id).toBeUndefined()
  })

  it('returns the new room id on success', async () => {
    mockAuthed()
    createDbMocks()
    const res = await POST(makeRequest('room-src', { name: 'New Room' }), { params: Promise.resolve({ id: 'room-src' }) })
    const body = await res.json()
    expect(body.id).toBe('room-new')
  })

  it('returns 500 when room insert fails', async () => {
    mockAuthed()
    createDbMocks({ insertError: 'DB error' })
    const res = await POST(makeRequest('room-src', { name: 'New Room' }), { params: Promise.resolve({ id: 'room-src' }) })
    expect(res.status).toBe(500)
  })
})
