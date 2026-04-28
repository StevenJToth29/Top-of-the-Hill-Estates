/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { POST, PATCH } from '@/app/api/admin/rooms/route'

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

function createDbMocks() {
  const singleResult = { data: { id: 'room-1' }, error: null }
  const insertChain = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(singleResult),
  }
  const roomsInsert = jest.fn().mockReturnValue(insertChain)
  const roomsUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
  const roomFeesSelect = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: [], error: null }) })
  const roomFeesDelete = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
  const roomFeesInsert = jest.fn().mockResolvedValue({ error: null })

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'rooms') return { insert: roomsInsert, update: roomsUpdate }
      if (table === 'room_fees') return { select: roomFeesSelect, delete: roomFeesDelete, insert: roomFeesInsert }
    }),
  })

  return { roomsInsert, roomsUpdate, roomFeesSelect, roomFeesDelete, roomFeesInsert }
}

describe('POST /api/admin/rooms', () => {
  beforeEach(() => jest.clearAllMocks())

  it('persists cleaning_fee, security_deposit, extra_guest_fee', async () => {
    mockAuthed()
    const { roomsInsert } = createDbMocks()

    const req = new Request('http://localhost/api/admin/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: 'prop-1',
        name: 'Suite 1',
        slug: 'suite-1',
        cleaning_fee: 75,
        security_deposit: 500,
        extra_guest_fee: 15,
        fees: [],
      }),
    })

    await POST(req)

    const insertArg = roomsInsert.mock.calls[0][0]
    expect(insertArg.cleaning_fee).toBe(75)
    expect(insertArg.security_deposit).toBe(500)
    expect(insertArg.extra_guest_fee).toBe(15)
  })

  it('persists max_advance_booking_days and max_advance_booking_applies_to when provided', async () => {
    mockAuthed()
    const { roomsInsert } = createDbMocks()

    const req = new Request('http://localhost/api/admin/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: 'prop-1',
        name: 'Suite 1',
        slug: 'suite-1',
        max_advance_booking_days: 90,
        max_advance_booking_applies_to: 'short_term',
        fees: [],
      }),
    })

    await POST(req)

    const insertArg = roomsInsert.mock.calls[0][0]
    expect(insertArg.max_advance_booking_days).toBe(90)
    expect(insertArg.max_advance_booking_applies_to).toBe('short_term')
  })

  it('defaults max_advance_booking_days to 182 and applies_to to "both" when omitted', async () => {
    mockAuthed()
    const { roomsInsert } = createDbMocks()

    const req = new Request('http://localhost/api/admin/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: 'prop-1', name: 'Suite 1', slug: 'suite-1', fees: [] }),
    })

    await POST(req)

    const insertArg = roomsInsert.mock.calls[0][0]
    expect(insertArg.max_advance_booking_days).toBe(182)
    expect(insertArg.max_advance_booking_applies_to).toBe('both')
  })

  it('persists max_advance_booking_days of 0 (blocks all advance bookings)', async () => {
    mockAuthed()
    const { roomsInsert } = createDbMocks()

    const req = new Request('http://localhost/api/admin/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: 'prop-1',
        name: 'Suite 1',
        slug: 'suite-1',
        max_advance_booking_days: 0,
        fees: [],
      }),
    })

    await POST(req)

    const insertArg = roomsInsert.mock.calls[0][0]
    expect(insertArg.max_advance_booking_days).toBe(0)
  })

  it('inserts room_fees rows after creating room', async () => {
    mockAuthed()
    const { roomFeesInsert } = createDbMocks()

    const req = new Request('http://localhost/api/admin/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: 'prop-1',
        name: 'Suite 1',
        slug: 'suite-1',
        fees: [{ label: 'Pet fee', amount: 50, calculation_type: 'fixed', booking_type: 'both' }],
      }),
    })

    await POST(req)

    expect(roomFeesInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Pet fee', amount: 50, booking_type: 'both', room_id: 'room-1' }),
      ])
    )
  })

  it('skips room_fees insert when fees array is empty', async () => {
    mockAuthed()
    const { roomFeesInsert } = createDbMocks()

    const req = new Request('http://localhost/api/admin/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: 'prop-1', name: 'Suite 1', slug: 'suite-1', fees: [] }),
    })

    await POST(req)

    expect(roomFeesInsert).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/admin/rooms', () => {
  beforeEach(() => jest.clearAllMocks())

  it('updates cleaning_fee, security_deposit, extra_guest_fee', async () => {
    mockAuthed()
    const { roomsUpdate } = createDbMocks()

    const req = new Request('http://localhost/api/admin/rooms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'room-1',
        cleaning_fee: 100,
        security_deposit: 300,
        extra_guest_fee: 20,
        fees: [],
      }),
    })

    await PATCH(req)

    const updateArg = roomsUpdate.mock.calls[0][0]
    expect(updateArg.cleaning_fee).toBe(100)
    expect(updateArg.security_deposit).toBe(300)
    expect(updateArg.extra_guest_fee).toBe(20)
  })

  it('updates max_advance_booking_days and max_advance_booking_applies_to when provided', async () => {
    mockAuthed()
    const { roomsUpdate } = createDbMocks()

    const req = new Request('http://localhost/api/admin/rooms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'room-1',
        max_advance_booking_days: 60,
        max_advance_booking_applies_to: 'long_term',
        fees: [],
      }),
    })

    await PATCH(req)

    const updateArg = roomsUpdate.mock.calls[0][0]
    expect(updateArg.max_advance_booking_days).toBe(60)
    expect(updateArg.max_advance_booking_applies_to).toBe('long_term')
  })

  it('defaults max_advance_booking_days to 182 and applies_to to "both" in PATCH when omitted', async () => {
    mockAuthed()
    const { roomsUpdate } = createDbMocks()

    const req = new Request('http://localhost/api/admin/rooms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'room-1', fees: [] }),
    })

    await PATCH(req)

    const updateArg = roomsUpdate.mock.calls[0][0]
    expect(updateArg.max_advance_booking_days).toBe(182)
    expect(updateArg.max_advance_booking_applies_to).toBe('both')
  })

  it('deletes existing room_fees before inserting new ones (atomic replace)', async () => {
    mockAuthed()
    const { roomFeesDelete, roomFeesInsert } = createDbMocks()

    const req = new Request('http://localhost/api/admin/rooms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'room-1',
        fees: [{ label: 'Parking', amount: 20, calculation_type: 'fixed', booking_type: 'short_term' }],
      }),
    })

    await PATCH(req)

    expect(roomFeesDelete).toHaveBeenCalled()
    expect(roomFeesInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Parking', amount: 20, booking_type: 'short_term' }),
      ])
    )
  })

  it('PATCH with empty fees array still deletes existing room_fees', async () => {
    mockAuthed()
    const { roomFeesDelete, roomFeesInsert } = createDbMocks()

    const req = new Request('http://localhost/api/admin/rooms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'room-1', fees: [] }),
    })

    await PATCH(req)

    expect(roomFeesDelete).toHaveBeenCalled()
    expect(roomFeesInsert).not.toHaveBeenCalled()
  })
})
