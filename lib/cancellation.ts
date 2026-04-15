import type { Booking, RefundResult } from '@/types'
import { differenceInHours } from 'date-fns/differenceInHours'
import { parseISO } from 'date-fns/parseISO'

/**
 * Calculates the refund amount based on the cancellation policy.
 * The Stripe processing fee is always excluded from any refund.
 *
 * Short-term policy:
 *   - Cancelled > 7 days before check-in → 100% refund (excl. processing fee)
 *   - Cancelled > 72 hours but within 7 days before check-in → 50% refund (excl. processing fee)
 *   - Cancelled within 72 hours of check-in → 0% refund
 *
 * Long-term policy:
 *   - Deposit is non-refundable → 0% refund always
 */
export function calculateRefund(booking: Booking, cancelledAt: Date): RefundResult {
  const checkInDate = parseISO(booking.check_in)
  const hoursUntilCheckIn = differenceInHours(checkInDate, cancelledAt)
  const processingFee = booking.processing_fee ?? 0
  const refundableAmount = booking.amount_paid - processingFee

  if (booking.booking_type === 'long_term') {
    return {
      refund_amount: 0,
      refund_percentage: 0,
      policy_description:
        'Long-term booking deposits are non-refundable.',
    }
  }

  if (hoursUntilCheckIn > 7 * 24) {
    return {
      refund_amount: Math.round(refundableAmount * 100) / 100,
      refund_percentage: 100,
      policy_description: 'Cancelled more than 7 days before check-in — full refund issued (processing fee excluded).',
    }
  }

  if (hoursUntilCheckIn > 72) {
    return {
      refund_amount: Math.round(refundableAmount * 0.5 * 100) / 100,
      refund_percentage: 50,
      policy_description:
        'Cancelled within 7 days but more than 72 hours before check-in — 50% refund issued (processing fee excluded).',
    }
  }

  return {
    refund_amount: 0,
    refund_percentage: 0,
    policy_description: 'Cancelled within 72 hours of check-in — no refund issued.',
  }
}
