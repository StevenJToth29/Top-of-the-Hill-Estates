/** @jest-environment node */
import {
  calculateRefund,
  isWithinCancellationWindow,
  resolvePolicy,
  DEFAULT_POLICY,
} from '@/lib/cancellation'
import type { Booking, CancellationPolicy } from '@/types'

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

describe('DEFAULT_POLICY', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_POLICY).toEqual({
      full_refund_days: 7,
      partial_refund_hours: 72,
      partial_refund_percent: 50,
    })
  })
})

describe('resolvePolicy', () => {
  const systemPolicy: CancellationPolicy = { full_refund_days: 7, partial_refund_hours: 72, partial_refund_percent: 50 }
  const propertyPolicy: CancellationPolicy = { full_refund_days: 14, partial_refund_hours: 48, partial_refund_percent: 25 }
  const roomPolicy: CancellationPolicy = { full_refund_days: 3, partial_refund_hours: 24, partial_refund_percent: 0 }

  it('returns system policy when both room and property inherit', () => {
    const result = resolvePolicy(
      { use_property_cancellation_policy: true, cancellation_policy: null },
      { use_global_cancellation_policy: true, cancellation_policy: null },
      { cancellation_policy: JSON.stringify(systemPolicy) },
    )
    expect(result).toEqual(systemPolicy)
  })

  it('falls back to DEFAULT_POLICY when system has no policy set', () => {
    const result = resolvePolicy(
      { use_property_cancellation_policy: true, cancellation_policy: null },
      { use_global_cancellation_policy: true, cancellation_policy: null },
      { cancellation_policy: null },
    )
    expect(result).toEqual(DEFAULT_POLICY)
  })

  it('returns property policy when room inherits but property does not', () => {
    const result = resolvePolicy(
      { use_property_cancellation_policy: true, cancellation_policy: JSON.stringify(roomPolicy) },
      { use_global_cancellation_policy: false, cancellation_policy: JSON.stringify(propertyPolicy) },
      { cancellation_policy: JSON.stringify(systemPolicy) },
    )
    expect(result).toEqual(propertyPolicy)
  })

  it('returns room policy when room does not inherit', () => {
    const result = resolvePolicy(
      { use_property_cancellation_policy: false, cancellation_policy: JSON.stringify(roomPolicy) },
      { use_global_cancellation_policy: false, cancellation_policy: JSON.stringify(propertyPolicy) },
      { cancellation_policy: JSON.stringify(systemPolicy) },
    )
    expect(result).toEqual(roomPolicy)
  })

  it('falls back to DEFAULT_POLICY when room has no policy set even if not inheriting', () => {
    const result = resolvePolicy(
      { use_property_cancellation_policy: false, cancellation_policy: null },
      { use_global_cancellation_policy: true, cancellation_policy: null },
      null,
    )
    expect(result).toEqual(DEFAULT_POLICY)
  })
})

describe('calculateRefund', () => {
  it('returns full refund when cancelled more than full_refund_days before check-in', () => {
    const booking = makeBooking({ check_in: '2026-06-20', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-10T12:00:00Z') // 10 days before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(500)
    expect(result.refund_percentage).toBe(100)
  })

  it('returns partial% refund when cancelled within full_refund_days but outside partial_refund_hours', () => {
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-06T12:00:00Z') // 96h before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(250)
    expect(result.refund_percentage).toBe(50)
  })

  it('returns 0 refund when cancelled within partial_refund_hours', () => {
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-08T12:00:00Z') // 48h before
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(0)
    expect(result.refund_percentage).toBe(0)
  })

  it('respects a custom policy with partial_refund_hours: 48', () => {
    const policy: CancellationPolicy = { full_refund_days: 7, partial_refund_hours: 48, partial_refund_percent: 50 }
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    // 60h before — outside 48h window so 50% refund
    const cancelledAt = new Date('2026-06-07T12:00:00Z')
    expect(calculateRefund(booking, cancelledAt, policy).refund_percentage).toBe(50)
  })

  it('respects a custom partial_refund_percent', () => {
    const policy: CancellationPolicy = { full_refund_days: 7, partial_refund_hours: 72, partial_refund_percent: 25 }
    const booking = makeBooking({ check_in: '2026-06-10', amount_paid: 500 })
    const cancelledAt = new Date('2026-06-06T12:00:00Z') // 96h before, inside 7 days
    const result = calculateRefund(booking, cancelledAt, policy)
    expect(result.refund_amount).toBe(125) // 500 * 0.25
    expect(result.refund_percentage).toBe(25)
  })

  it('always returns 0 for long_term bookings', () => {
    const booking = makeBooking({ booking_type: 'long_term', check_in: '2026-06-20', amount_paid: 1000 })
    const cancelledAt = new Date('2026-05-01T12:00:00Z')
    const result = calculateRefund(booking, cancelledAt)
    expect(result.refund_amount).toBe(0)
    expect(result.refund_percentage).toBe(0)
  })

  describe('processing fee exclusion', () => {
    it('excludes processing_fee from full refund', () => {
      const booking = makeBooking({ check_in: '2030-06-20', amount_paid: 539.25, processing_fee: 14.25 })
      const cancelledAt = new Date('2030-06-10T12:00:00Z')
      expect(calculateRefund(booking, cancelledAt).refund_amount).toBe(525.00)
    })

    it('excludes processing_fee from partial refund', () => {
      const booking = makeBooking({ check_in: '2030-06-20', amount_paid: 539.25, processing_fee: 14.25 })
      const cancelledAt = new Date('2030-06-15T12:00:00Z') // 5 days before
      expect(calculateRefund(booking, cancelledAt).refund_amount).toBe(262.50)
    })

    it('returns 0 within partial_refund_hours regardless of processing_fee', () => {
      const booking = makeBooking({ check_in: '2030-06-20', amount_paid: 539.25, processing_fee: 14.25 })
      const cancelledAt = new Date('2030-06-19T12:00:00Z')
      expect(calculateRefund(booking, cancelledAt).refund_amount).toBe(0)
    })
  })
})

describe('isWithinCancellationWindow', () => {
  it('returns true when check-in is within the window', () => {
    const booking = makeBooking({ check_in: '2026-06-10' })
    const now = new Date('2026-06-08T12:00:00Z')
    expect(isWithinCancellationWindow(booking, now, 72)).toBe(true)
  })

  it('returns false when check-in is outside the window', () => {
    const booking = makeBooking({ check_in: '2026-06-10' })
    const now = new Date('2026-06-05T12:00:00Z')
    expect(isWithinCancellationWindow(booking, now, 72)).toBe(false)
  })

  it('returns true at the exact boundary', () => {
    const booking = makeBooking({ check_in: '2026-06-10' })
    const now = new Date('2026-06-07T00:00:00Z')
    expect(isWithinCancellationWindow(booking, now, 72)).toBe(true)
  })
})
