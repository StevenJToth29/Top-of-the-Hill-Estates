import { calculateRefund } from '@/lib/cancellation'
import type { Booking } from '@/types'

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'test-id',
    room_id: 'room-id',
    booking_type: 'short_term',
    guest_first_name: 'Jane',
    guest_last_name: 'Smith',
    guest_email: 'jane@example.com',
    guest_phone: '5555555555',
    check_in: '2030-06-20',
    check_out: '2030-06-23',
    total_nights: 3,
    nightly_rate: 150,
    monthly_rate: 0,
    cleaning_fee: 75,
    security_deposit: 0,
    extra_guest_fee: 0,
    processing_fee: 14.25,
    guest_count: 1,
    total_amount: 539.25,
    amount_paid: 539.25,
    amount_due_at_checkin: 0,
    stripe_payment_intent_id: 'pi_test',
    stripe_session_id: null,
    status: 'confirmed',
    cancellation_reason: null,
    cancelled_at: null,
    refund_amount: null,
    ghl_contact_id: null,
    sms_consent: true,
    marketing_consent: false,
    created_at: '2030-01-01T00:00:00Z',
    updated_at: '2030-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('calculateRefund', () => {
  describe('short_term - full refund window (>7 days out)', () => {
    it('refunds amount_paid minus processing_fee', () => {
      const booking = makeBooking({ amount_paid: 539.25, processing_fee: 14.25 })
      // Cancel 10 days before check-in
      const cancelledAt = new Date('2030-06-10T12:00:00Z')
      const result = calculateRefund(booking, cancelledAt)
      expect(result.refund_amount).toBe(525.00)  // 539.25 - 14.25
      expect(result.refund_percentage).toBe(100)
    })
  })

  describe('short_term - 50% refund window (3–7 days out)', () => {
    it('refunds 50% of (amount_paid - processing_fee)', () => {
      const booking = makeBooking({ amount_paid: 539.25, processing_fee: 14.25 })
      // Cancel 5 days before check-in
      const cancelledAt = new Date('2030-06-15T12:00:00Z')
      const result = calculateRefund(booking, cancelledAt)
      expect(result.refund_amount).toBe(262.50)  // (539.25 - 14.25) * 0.5
      expect(result.refund_percentage).toBe(50)
    })
  })

  describe('short_term - no refund window (<72 hours out)', () => {
    it('returns 0 refund', () => {
      const booking = makeBooking({ amount_paid: 539.25, processing_fee: 14.25 })
      // Cancel 1 day before check-in
      const cancelledAt = new Date('2030-06-19T12:00:00Z')
      const result = calculateRefund(booking, cancelledAt)
      expect(result.refund_amount).toBe(0)
    })
  })

  describe('long_term', () => {
    it('always returns 0 refund regardless of processing_fee', () => {
      const booking = makeBooking({
        booking_type: 'long_term',
        amount_paid: 1500,
        processing_fee: 43.80,
      })
      const cancelledAt = new Date('2030-06-10T12:00:00Z')
      const result = calculateRefund(booking, cancelledAt)
      expect(result.refund_amount).toBe(0)
    })
  })

  describe('processing_fee is 0', () => {
    it('full refund equals amount_paid when no processing fee', () => {
      const booking = makeBooking({ amount_paid: 525.00, processing_fee: 0 })
      const cancelledAt = new Date('2030-06-10T12:00:00Z')
      const result = calculateRefund(booking, cancelledAt)
      expect(result.refund_amount).toBe(525.00)
    })
  })
})
