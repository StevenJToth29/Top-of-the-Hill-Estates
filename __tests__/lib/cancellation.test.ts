/** @jest-environment node */
import { calculateRefund, isWithinCancellationWindow } from '@/lib/cancellation'
import type { Booking } from '@/types'

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    room_id: 'room-1',
    booking_type: 'short_term',
    guest_first_name: 'Jane',
    guest_last_name: 'Smith',
    guest_email: 'jane@example.com',
    guest_phone: '5550001234',
    check_in: '2026-06-10',
    check_out: '2026-06-15',
    total_nights: 5,
    nightly_rate: 100,
    monthly_rate: 0,
    cleaning_fee: 50,
    security_deposit: 0,
    extra_guest_fee: 0,
    processing_fee: 0,
    guest_count: 1,
    total_amount: 550,
    amount_paid: 550,
    amount_due_at_checkin: 0,
    stripe_payment_intent_id: null,
    stripe_session_id: null,
    status: 'confirmed',
    cancellation_reason: null,
    cancelled_at: null,
    refund_amount: null,
    ghl_contact_id: null,
    sms_consent: false,
    marketing_consent: false,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

describe('calculateRefund', () => {
  it('returns full refund when cancelled more than 7 days before check-in', () => {
    const booking = makeBooking({ check_in: '2026-06-20', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-10T12:00:00Z') // 10 days before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(500)
    expect(result.refund_percentage).toBe(100)
  })

  it('returns 50% refund when cancelled within 7 days but outside default 72h window', () => {
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-06T12:00:00Z') // 96h before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(250)
    expect(result.refund_percentage).toBe(50)
  })

  it('returns 0 refund when cancelled within default 72h window', () => {
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-08T12:00:00Z') // 48h before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(0)
    expect(result.refund_percentage).toBe(0)
  })

  it('respects a custom windowHours of 48', () => {
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    // 60h before — outside 48h window (50%) but inside 72h window (0%)
    const cancelledAt = new Date('2026-06-07T12:00:00Z')
    expect(calculateRefund(booking, cancelledAt, 48).refund_percentage).toBe(50)
    expect(calculateRefund(booking, cancelledAt, 72).refund_percentage).toBe(0)
  })

  it('includes windowHours value in policy_description', () => {
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-09T12:00:00Z') // 24h before
    expect(calculateRefund(booking, cancelledAt, 48).policy_description).toContain('48')
  })

  it('always returns 0 for long_term bookings regardless of timing', () => {
    const booking = makeBooking({ booking_type: 'long_term', check_in: '2026-06-20', amount_paid: 1000 })
    const cancelledAt = new Date('2026-05-01T12:00:00Z') // 50 days before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(0)
    expect(result.refund_percentage).toBe(0)
  })

  describe('processing fee exclusion', () => {
    it('excludes processing_fee from full refund', () => {
      const booking = makeBooking({ check_in: '2030-06-20', amount_paid: 539.25, processing_fee: 14.25 })
      const cancelledAt = new Date('2030-06-10T12:00:00Z') // 10 days before
      const result = calculateRefund(booking, cancelledAt)
      expect(result.refund_amount).toBe(525.00)  // 539.25 - 14.25
      expect(result.refund_percentage).toBe(100)
    })

    it('excludes processing_fee from 50% refund', () => {
      const booking = makeBooking({ check_in: '2030-06-20', amount_paid: 539.25, processing_fee: 14.25 })
      const cancelledAt = new Date('2030-06-15T12:00:00Z') // 5 days before
      const result = calculateRefund(booking, cancelledAt)
      expect(result.refund_amount).toBe(262.50)  // (539.25 - 14.25) * 0.5
      expect(result.refund_percentage).toBe(50)
    })

    it('returns 0 when cancelled within 72h regardless of processing_fee', () => {
      const booking = makeBooking({ check_in: '2030-06-20', amount_paid: 539.25, processing_fee: 14.25 })
      const cancelledAt = new Date('2030-06-19T12:00:00Z') // 1 day before
      expect(calculateRefund(booking, cancelledAt).refund_amount).toBe(0)
    })

    it('full refund equals amount_paid when processing_fee is 0', () => {
      const booking = makeBooking({ check_in: '2030-06-20', amount_paid: 525.00, processing_fee: 0 })
      const cancelledAt = new Date('2030-06-10T12:00:00Z')
      expect(calculateRefund(booking, cancelledAt).refund_amount).toBe(525.00)
    })
  })
})

describe('isWithinCancellationWindow', () => {
  it('returns true when check-in is within the window', () => {
    const booking = makeBooking({ check_in: '2026-06-10' })
    const now = new Date('2026-06-08T12:00:00Z') // 36h before
    expect(isWithinCancellationWindow(booking, now, 72)).toBe(true)
  })

  it('returns false when check-in is outside the window', () => {
    const booking = makeBooking({ check_in: '2026-06-10' })
    const now = new Date('2026-06-05T12:00:00Z') // 108h before
    expect(isWithinCancellationWindow(booking, now, 72)).toBe(false)
  })

  it('returns true at the exact boundary (hoursUntilCheckIn === windowHours)', () => {
    const booking = makeBooking({ check_in: '2026-06-10' })
    const now = new Date('2026-06-07T00:00:00Z') // exactly 72h before midnight
    expect(isWithinCancellationWindow(booking, now, 72)).toBe(true)
  })
})
