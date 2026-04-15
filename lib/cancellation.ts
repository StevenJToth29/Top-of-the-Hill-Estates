import type { Booking, RefundResult } from '@/types'
import { differenceInHours } from 'date-fns/differenceInHours'
import { parseISO } from 'date-fns/parseISO'

/**
 * Calculates the refund amount based on the cancellation policy.
 *
 * Short-term policy:
 *   - Cancelled > 7 days before check-in → 100% refund
 *   - Cancelled > windowHours but within 7 days before check-in → 50% refund
 *   - Cancelled within windowHours of check-in → 0% refund
 *
 * Long-term policy:
 *   - Deposit is non-refundable → 0% refund always
 *
 * @param windowHours - Configurable inner cutoff (default 72). Set per room via cancellation_window_hours.
 */
export function calculateRefund(
  booking: Booking,
  cancelledAt: Date,
  windowHours = 72,
): RefundResult {
  const checkInDate = parseISO(booking.check_in)
  const hoursUntilCheckIn = differenceInHours(checkInDate, cancelledAt)

  if (booking.booking_type === 'long_term') {
    return {
      refund_amount: 0,
      refund_percentage: 0,
      policy_description: 'Long-term booking deposits are non-refundable.',
    }
  }

  if (hoursUntilCheckIn > 7 * 24) {
    return {
      refund_amount: booking.amount_paid,
      refund_percentage: 100,
      policy_description: 'Cancelled more than 7 days before check-in — full refund issued.',
    }
  }

  if (hoursUntilCheckIn > windowHours) {
    return {
      refund_amount: Math.round(booking.amount_paid * 0.5 * 100) / 100,
      refund_percentage: 50,
      policy_description: `Cancelled within 7 days but more than ${windowHours} hours before check-in — 50% refund issued.`,
    }
  }

  return {
    refund_amount: 0,
    refund_percentage: 0,
    policy_description: `Cancelled within ${windowHours} hours of check-in — no refund issued.`,
  }
}

/**
 * Returns true if check-in is within the cancellation window from now.
 * Used to gate both cancel and modify actions on the guest management page.
 */
export function isWithinCancellationWindow(
  booking: Booking,
  now: Date,
  windowHours = 72,
): boolean {
  const checkInDate = parseISO(booking.check_in)
  const hoursUntilCheckIn = differenceInHours(checkInDate, now)
  return hoursUntilCheckIn <= windowHours
}
