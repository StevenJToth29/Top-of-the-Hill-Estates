/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn(), createServerSupabaseClient: jest.fn() }))
jest.mock('@/lib/stripe', () => ({
  stripe: {
    refunds: { create: jest.fn().mockResolvedValue({}) },
    checkout: { sessions: { create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }) } },
  },
}))
jest.mock('@/lib/availability', () => ({
  isRoomAvailableExcluding: jest.fn().mockResolvedValue(true),
}))
jest.mock('@/lib/email-queue', () => ({
  evaluateAndQueueEmails: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { isRoomAvailableExcluding } from '@/lib/availability'
import { evaluateAndQueueEmails } from '@/lib/email-queue'
import { PATCH } from '@/app/api/admin/bookings/[id]/edit/route'

const mockParams = { params: Promise.resolve({ id: 'booking-1' }) }

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/bookings/booking-1/edit', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseBooking = {
  id: 'booking-1',
  room_id: 'room-1',
  booking_type: 'short_term',
  status: 'confirmed',
  check_in: '2026-05-01',
  check_out: '2026-05-05',
  guest_first_name: 'Jane',
  guest_last_name: 'Doe',
  guest_email: 'jane@example.com',
  guest_phone: '555-0100',
  guest_count: 2,
  total_nights: 4,
  total_amount: 600,
  amount_paid: 600,
  amount_due_at_checkin: 0,
  stripe_payment_intent_id: 'pi_test' as string | null,
  notes: null,
}

const baseRoom = {
  nightly_rate: 150,
  monthly_rate: 3000,
  cleaning_fee: 0,
  security_deposit: 0,
  extra_guest_fee: 0,
}

function setupMocks(booking = baseBooking, room = baseRoom, bookingFees: Array<{amount: number}> = []) {
  const updatedBooking = { ...booking }
  const updateChain = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: updatedBooking, error: null }),
  }
  const update = jest.fn().mockReturnValue(updateChain)

  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }),
    },
  })
  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: booking, error: null }),
          update,
        }
      }
      if (table === 'rooms') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: room, error: null }),
        }
      }
      if (table === 'booking_fees') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: bookingFees, error: null }),
        }
      }
      if (table === 'date_overrides') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          not: jest.fn().mockResolvedValue({ data: [] }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [] }) }
    }),
  })
  return { update, updateChain }
}

describe('PATCH /api/admin/bookings/[id]/edit', () => {

  beforeEach(() => {
    jest.clearAllMocks()
    // The 409 test sets this to false — restore for other tests
    ;(isRoomAvailableExcluding as jest.Mock).mockResolvedValue(true)
  })

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: jest.fn() })
    const res = await PATCH(makeRequest({}), mockParams)
    expect(res.status).toBe(401)
  })

  it('returns 404 when booking does not exist', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }) },
    })
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      })),
    })
    const res = await PATCH(makeRequest({ check_in: '2026-05-01', check_out: '2026-05-07' }), mockParams)
    expect(res.status).toBe(404)
  })

  it('returns 400 when trying to edit a cancelled booking', async () => {
    setupMocks({ ...baseBooking, status: 'cancelled' })
    const res = await PATCH(makeRequest({ check_in: '2026-05-01', check_out: '2026-05-07' }), mockParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/cancelled/)
  })

  it('returns 400 when trying to edit a completed booking', async () => {
    setupMocks({ ...baseBooking, status: 'completed' })
    const res = await PATCH(makeRequest({ check_in: '2026-05-01', check_out: '2026-05-07' }), mockParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/completed/)
  })

  it('returns 409 when new dates conflict with another booking', async () => {
    setupMocks()
    ;(isRoomAvailableExcluding as jest.Mock).mockResolvedValue(false)
    const res = await PATCH(makeRequest({ check_in: '2026-05-01', check_out: '2026-05-10' }), mockParams)
    expect(res.status).toBe(409)
  })

  it('updates booking record and returns it on success', async () => {
    const { update } = setupMocks()
    const res = await PATCH(
      makeRequest({ check_in: '2026-05-01', check_out: '2026-05-05', guest_count: 2 }),
      mockParams,
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.booking).toBeDefined()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ check_in: '2026-05-01', check_out: '2026-05-05' }),
    )
  })

  it('includes booking_fees in total recalculation', async () => {
    // 4 nights at $150 = $600; booking fee = $50 → newTotal = $650
    const { update } = setupMocks(
      { ...baseBooking, amount_paid: 650 },
      baseRoom,
      [{ amount: 50 }],
    )
    const res = await PATCH(
      makeRequest({ check_in: '2026-05-01', check_out: '2026-05-05' }),
      mockParams,
    )
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ total_amount: 650 }),
    )
  })

  it('issues Stripe refund when new total is lower than amount paid', async () => {
    // 4 nights at $150 = $600 paid; new 2 nights = $300 → refund $300
    setupMocks({ ...baseBooking, amount_paid: 600 })
    await PATCH(
      makeRequest({ check_in: '2026-05-01', check_out: '2026-05-03' }),
      mockParams,
    )
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_test', amount: 30000 }),
    )
  })

  it('creates Checkout session and queues email when new total is higher than amount paid', async () => {
    // 4 nights at $150 = $600 paid; new 6 nights = $900 → additional $300
    setupMocks({ ...baseBooking, amount_paid: 600 })
    await PATCH(
      makeRequest({ check_in: '2026-05-01', check_out: '2026-05-07' }),
      mockParams,
    )
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'payment' }),
    )
    expect(evaluateAndQueueEmails).toHaveBeenCalledWith(
      'booking_payment_request',
      expect.objectContaining({ type: 'booking_payment_request', bookingId: 'booking-1' }),
    )
  })

  it('skips Stripe entirely for manual bookings (no stripe_payment_intent_id)', async () => {
    setupMocks({ ...baseBooking, stripe_payment_intent_id: null, amount_paid: 600 })
    await PATCH(
      makeRequest({ check_in: '2026-05-01', check_out: '2026-05-07' }),
      mockParams,
    )
    expect(stripe.refunds.create).not.toHaveBeenCalled()
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('recalculates long_term total based on guest_count and includes booking_fees', async () => {
    const ltBooking = {
      ...baseBooking,
      booking_type: 'long_term',
      check_out: '9999-12-31',
      total_nights: 0,
      total_amount: 3500,
      amount_paid: 3500,
    }
    const ltRoom = { ...baseRoom, monthly_rate: 3000, security_deposit: 500, extra_guest_fee: 100 }
    const { update } = setupMocks(ltBooking, ltRoom, [{ amount: 50 }])
    // 3 guests → extraGuests = 2 → newTotal = 3000 + 500 + 100*2 + 50 = 3750
    await PATCH(makeRequest({ guest_count: 3 }), mockParams)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ total_amount: 3750 }),
    )
  })

  it('clamps guest_count to minimum of 1', async () => {
    const { update } = setupMocks()
    await PATCH(
      makeRequest({ check_in: '2026-05-01', check_out: '2026-05-05', guest_count: 0 }),
      mockParams,
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ guest_count: 1 }),
    )
  })
})
