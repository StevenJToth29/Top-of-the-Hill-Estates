/** @jest-environment node */

jest.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ id: 'pi_test', client_secret: 'secret_test' }),
    },
  },
}))

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}))

jest.mock('@/lib/availability', () => ({
  isRoomAvailable: jest.fn().mockResolvedValue(true),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import { POST } from '@/app/api/bookings/route'

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setupMocks(
  room: Record<string, unknown>,
  fees: { id: string; label: string; amount: number; booking_type: string }[] = []
) {
  const bookingInsert = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'booking-1' }, error: null }),
  }
  const bookingFeesInsert = jest.fn().mockResolvedValue({ error: null })

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'rooms') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: room, error: null }),
        }
      }
      if (table === 'room_fees') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: fees, error: null }),
        }
      }
      if (table === 'bookings') {
        return { insert: jest.fn().mockReturnValue(bookingInsert) }
      }
      if (table === 'booking_fees') {
        return { insert: bookingFeesInsert }
      }
    }),
  })

  return { bookingFeesInsert }
}

const baseBody = {
  room_id: 'room-1',
  guest_first_name: 'Jane',
  guest_last_name: 'Smith',
  guest_email: 'jane@example.com',
  guest_phone: '5550001234',
  check_in: '2026-06-01',
  check_out: '2026-06-06',
  total_nights: 5,
  guest_count: 1,
  sms_consent: true,
  marketing_consent: false,
}

describe('POST /api/bookings — short-term pricing', () => {
  beforeEach(() => jest.clearAllMocks())

  it('total = nights × rate + cleaning_fee (no extra guests)', async () => {
    setupMocks({ nightly_rate: 100, monthly_rate: 900, cleaning_fee: 75, security_deposit: 0, extra_guest_fee: 0 })

    const res = await POST(makeRequest({ ...baseBody, booking_type: 'short_term' }))
    const data = await res.json()

    // 5 × 100 + 75 = 575
    expect(data.total_amount).toBe(575)
    expect(data.amount_due_at_checkin).toBe(0)
  })

  it('extra_guest_fee multiplied by (guests - 1) × nights', async () => {
    setupMocks({ nightly_rate: 100, monthly_rate: 900, cleaning_fee: 0, security_deposit: 0, extra_guest_fee: 15 })

    const res = await POST(makeRequest({ ...baseBody, booking_type: 'short_term', guest_count: 3 }))
    const data = await res.json()

    // 5 × 100 + (3-1) × 15 × 5 = 500 + 150 = 650
    expect(data.total_amount).toBe(650)
  })

  it('1 guest incurs no extra_guest_fee', async () => {
    setupMocks({ nightly_rate: 100, monthly_rate: 900, cleaning_fee: 0, security_deposit: 0, extra_guest_fee: 25 })

    const res = await POST(makeRequest({ ...baseBody, booking_type: 'short_term', guest_count: 1 }))
    const data = await res.json()

    expect(data.total_amount).toBe(500) // no extra guest charge
  })

  it('generic room_fees (both/short_term) are summed and snapshotted', async () => {
    const { bookingFeesInsert } = setupMocks(
      { nightly_rate: 100, monthly_rate: 900, cleaning_fee: 0, security_deposit: 0, extra_guest_fee: 0 },
      [{ id: 'fee-1', label: 'Pet fee', amount: 50, booking_type: 'both' }]
    )

    const res = await POST(makeRequest({ ...baseBody, booking_type: 'short_term' }))
    const data = await res.json()

    // 5 × 100 + 50 = 550
    expect(data.total_amount).toBe(550)
    expect(bookingFeesInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Pet fee', amount: 50, booking_id: 'booking-1' }),
      ])
    )
  })
})

describe('POST /api/bookings — long-term pricing', () => {
  beforeEach(() => jest.clearAllMocks())

  it('total = monthly_rate + security_deposit, amount_due_at_checkin = 0', async () => {
    setupMocks({ nightly_rate: 100, monthly_rate: 900, cleaning_fee: 0, security_deposit: 500, extra_guest_fee: 0 })

    const res = await POST(makeRequest({ ...baseBody, booking_type: 'long_term' }))
    const data = await res.json()

    // 900 + 500 = 1400
    expect(data.total_amount).toBe(1400)
    expect(data.amount_due_at_checkin).toBe(0)
  })

  it('extra_guest_fee applied once per additional guest (not per night)', async () => {
    setupMocks({ nightly_rate: 100, monthly_rate: 900, cleaning_fee: 0, security_deposit: 500, extra_guest_fee: 50 })

    const res = await POST(makeRequest({ ...baseBody, booking_type: 'long_term', guest_count: 2 }))
    const data = await res.json()

    // 900 + 500 + (2-1) × 50 = 1450
    expect(data.total_amount).toBe(1450)
  })

  it('cleaning_fee is NOT applied on long-term stays', async () => {
    setupMocks({ nightly_rate: 100, monthly_rate: 900, cleaning_fee: 75, security_deposit: 0, extra_guest_fee: 0 })

    const res = await POST(makeRequest({ ...baseBody, booking_type: 'long_term' }))
    const data = await res.json()

    expect(data.total_amount).toBe(900) // cleaning fee excluded
  })
})
