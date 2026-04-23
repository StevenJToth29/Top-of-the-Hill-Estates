/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
  createServerSupabaseClient: jest.fn(),
}))
jest.mock('@/lib/availability', () => ({
  isRoomAvailable: jest.fn().mockResolvedValue(true),
}))
jest.mock('@/lib/email-queue', () => ({
  evaluateAndQueueEmails: jest.fn().mockResolvedValue(undefined),
  seedReminderEmails: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/ghl', () => ({
  notifyGHLBookingConfirmed: jest.fn().mockResolvedValue(undefined),
}))

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/availability'
import { POST } from '@/app/api/admin/bookings/manual/route'

const baseRoom = {
  nightly_rate: 150,
  monthly_rate: 2500,
  cleaning_fee: 75,
  security_deposit: 500,
  extra_guest_fee: 20,
}

const baseBody = {
  room_id: 'room-1',
  booking_type: 'short_term',
  guest_first_name: 'John',
  guest_last_name: 'Smith',
  guest_email: 'john@example.com',
  guest_phone: '555-0100',
  check_in: '2026-06-01',
  check_out: '2026-06-04',
  total_nights: 3,
  guest_count: 1,
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/bookings/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockAuthed() {
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'admin-1' } },
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
        error: null,
      }),
    },
  })
}

function mockDb(room = baseRoom, insertResult = { data: { id: 'booking-new', ...baseBody }, error: null }) {
  const insertChain = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(insertResult),
  }
  const insert = jest.fn().mockReturnValue(insertChain)

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'rooms') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: room, error: null }),
        }
      }
      if (table === 'date_overrides') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          not: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (table === 'bookings') {
        return { insert }
      }
      return {}
    }),
  })

  return { insert }
}

beforeEach(() => jest.clearAllMocks())

// ── Authentication ──────────────────────────────────────────────────────────

describe('POST /api/admin/bookings/manual — authentication', () => {
  it('returns 401 when not authenticated', async () => {
    mockUnauthed()
    const res = await POST(makeRequest(baseBody))
    expect(res.status).toBe(401)
  })
})

// ── Input validation ────────────────────────────────────────────────────────

describe('POST /api/admin/bookings/manual — validation', () => {
  beforeEach(mockAuthed)

  it.each([
    'room_id',
    'booking_type',
    'guest_first_name',
    'guest_last_name',
    'guest_email',
    'guest_phone',
    'check_in',
  ])('returns 400 when %s is missing', async (field) => {
    mockDb()
    const body = { ...baseBody, [field]: undefined }
    const res = await POST(makeRequest(body))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(field)
  })

  it('returns 400 for invalid booking_type', async () => {
    mockDb()
    const res = await POST(makeRequest({ ...baseBody, booking_type: 'weekly' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/booking_type/i)
  })

  it('returns 400 for short_term booking missing check_out', async () => {
    mockDb()
    const { check_out: _, ...body } = baseBody
    const res = await POST(makeRequest(body))
    expect(res.status).toBe(400)
  })
})

// ── Room lookup ─────────────────────────────────────────────────────────────

describe('POST /api/admin/bookings/manual — room lookup', () => {
  beforeEach(mockAuthed)

  it('returns 404 when room does not exist', async () => {
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'rooms') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }
        }
        return {}
      }),
    })
    const res = await POST(makeRequest(baseBody))
    expect(res.status).toBe(404)
  })
})

// ── Availability ────────────────────────────────────────────────────────────

describe('POST /api/admin/bookings/manual — availability', () => {
  beforeEach(mockAuthed)

  it('returns 409 when room is not available for the selected dates', async () => {
    mockDb()
    ;(isRoomAvailable as jest.Mock).mockResolvedValueOnce(false)
    const res = await POST(makeRequest(baseBody))
    expect(res.status).toBe(409)
  })

  it('skips availability check for open-ended long-term bookings', async () => {
    const { insert } = mockDb()
    const body = { ...baseBody, booking_type: 'long_term', check_out: undefined }
    const res = await POST(makeRequest(body))
    expect(isRoomAvailable).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalled()
    expect(res.status).toBe(201)
  })
})

// ── Amount computation ──────────────────────────────────────────────────────

describe('POST /api/admin/bookings/manual — amount computation', () => {
  beforeEach(mockAuthed)

  it('computes correct total for short-term: (nightly × nights) + cleaning fee', async () => {
    const { insert } = mockDb()
    // 3 nights × $150 + $75 cleaning = $525
    await POST(makeRequest(baseBody))
    const insertArg = insert.mock.calls[0][0]
    expect(insertArg.total_amount).toBe(525)
    expect(insertArg.cleaning_fee).toBe(75)
    expect(insertArg.security_deposit).toBe(0)
  })

  it('computes correct total for long-term: monthly_rate + security_deposit', async () => {
    const { insert } = mockDb()
    // $2500 monthly + $500 deposit = $3000
    const body = { ...baseBody, booking_type: 'long_term', check_out: undefined }
    await POST(makeRequest(body))
    const insertArg = insert.mock.calls[0][0]
    expect(insertArg.total_amount).toBe(3000)
    expect(insertArg.cleaning_fee).toBe(0)
    expect(insertArg.security_deposit).toBe(500)
  })

  it('adds extra guest fee for short-term when guest_count > 1', async () => {
    const { insert } = mockDb()
    // 3 nights × $150 + $75 cleaning + (1 extra × $20 × 3 nights) = $585
    const body = { ...baseBody, guest_count: 2 }
    await POST(makeRequest(body))
    const insertArg = insert.mock.calls[0][0]
    expect(insertArg.total_amount).toBe(585)
  })

  it('uses server-side room rates — ignores any client-supplied amounts', async () => {
    const { insert } = mockDb()
    const body = { ...baseBody, nightly_rate: 9999, total_amount: 99999 }
    await POST(makeRequest(body))
    const insertArg = insert.mock.calls[0][0]
    // Must use the mocked room rate ($150), not the client value
    expect(insertArg.nightly_rate).toBe(150)
    expect(insertArg.total_amount).toBe(525)
  })
})

// ── notes and source fields ─────────────────────────────────────────────────

describe('POST /api/admin/bookings/manual — notes and source fields', () => {
  beforeEach(mockAuthed)

  it('persists notes when provided', async () => {
    const { insert } = mockDb()
    const body = { ...baseBody, notes: 'Early check-in requested' }
    await POST(makeRequest(body))
    expect(insert.mock.calls[0][0].notes).toBe('Early check-in requested')
  })

  it('persists source when provided', async () => {
    const { insert } = mockDb()
    const body = { ...baseBody, source: 'referral' }
    await POST(makeRequest(body))
    expect(insert.mock.calls[0][0].source).toBe('referral')
  })

  it('defaults notes to null when not provided', async () => {
    const { insert } = mockDb()
    await POST(makeRequest(baseBody))
    expect(insert.mock.calls[0][0].notes).toBeNull()
  })

  it('defaults source to null when not provided', async () => {
    const { insert } = mockDb()
    await POST(makeRequest(baseBody))
    expect(insert.mock.calls[0][0].source).toBeNull()
  })
})

// ── Happy path ──────────────────────────────────────────────────────────────

describe('POST /api/admin/bookings/manual — success', () => {
  beforeEach(mockAuthed)

  it('returns 201 with the created booking on success', async () => {
    mockDb()
    const res = await POST(makeRequest(baseBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.booking).toBeDefined()
  })

  it('sets status to confirmed and amount_paid to 0', async () => {
    const { insert } = mockDb()
    await POST(makeRequest(baseBody))
    const insertArg = insert.mock.calls[0][0]
    expect(insertArg.status).toBe('confirmed')
    expect(insertArg.amount_paid).toBe(0)
  })

  it('enforces guest_count minimum of 1 when 0 is supplied', async () => {
    const { insert } = mockDb()
    await POST(makeRequest({ ...baseBody, guest_count: 0 }))
    expect(insert.mock.calls[0][0].guest_count).toBe(1)
  })
})
