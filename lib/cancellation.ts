import type { Booking, CancellationPolicy, RefundResult } from '@/types'
import { differenceInHours } from 'date-fns/differenceInHours'
import { parseISO } from 'date-fns/parseISO'

export const DEFAULT_POLICY: CancellationPolicy = {
  full_refund_days: 7,
  partial_refund_hours: 72,
  partial_refund_percent: 50,
}

function parsePolicy(json: string | object | null | undefined): CancellationPolicy | null {
  if (!json) return null
  if (typeof json === 'object') return json as CancellationPolicy
  try { return JSON.parse(json) as CancellationPolicy } catch { return null }
}

/**
 * Resolves the effective cancellation policy using 3-tier cascade:
 * room (if not inheriting) → property (if not inheriting) → system → DEFAULT_POLICY
 */
export function resolvePolicy(
  room: { cancellation_policy?: string | object | null; use_property_cancellation_policy?: boolean | null },
  property: { cancellation_policy?: string | object | null; use_global_cancellation_policy?: boolean | null },
  siteSettings: { cancellation_policy?: string | object | null } | null,
): CancellationPolicy {
  if (room.use_property_cancellation_policy === false) {
    return parsePolicy(room.cancellation_policy) ?? DEFAULT_POLICY
  }
  if (property.use_global_cancellation_policy === false) {
    return parsePolicy(property.cancellation_policy) ?? DEFAULT_POLICY
  }
  return parsePolicy(siteSettings?.cancellation_policy) ?? DEFAULT_POLICY
}

/**
 * Calculates refund amount based on timing and the effective cancellation policy.
 * Processing fee is always excluded from any refund.
 */
export function calculateRefund(
  booking: Booking,
  cancelledAt: Date,
  policy: CancellationPolicy = DEFAULT_POLICY,
): RefundResult {
  const checkInDate = parseISO(booking.check_in)
  const hoursUntilCheckIn = differenceInHours(checkInDate, cancelledAt)
  const processingFee = booking.processing_fee ?? 0
  const refundableAmount = booking.amount_paid - processingFee

  if (booking.booking_type === 'long_term') {
    return {
      refund_amount: 0,
      refund_percentage: 0,
      policy_description: 'Long-term booking deposits are non-refundable.',
    }
  }

  if (hoursUntilCheckIn > policy.full_refund_days * 24) {
    return {
      refund_amount: Math.round(refundableAmount * 100) / 100,
      refund_percentage: 100,
      policy_description: `Cancelled more than ${policy.full_refund_days} days before check-in — full refund issued (processing fee excluded).`,
    }
  }

  if (hoursUntilCheckIn > policy.partial_refund_hours) {
    const partialAmount = Math.round(refundableAmount * (policy.partial_refund_percent / 100) * 100) / 100
    return {
      refund_amount: partialAmount,
      refund_percentage: policy.partial_refund_percent,
      policy_description: `Cancelled within ${policy.full_refund_days} days but more than ${policy.partial_refund_hours} hours before check-in — ${policy.partial_refund_percent}% refund issued (processing fee excluded).`,
    }
  }

  return {
    refund_amount: 0,
    refund_percentage: 0,
    policy_description: `Cancelled within ${policy.partial_refund_hours} hours of check-in — no refund issued.`,
  }
}

/**
 * Returns true if check-in is within the cancellation window from now.
 * Used to gate modify actions on the guest management page.
 */
export function isWithinCancellationWindow(
  booking: Booking,
  now: Date,
  windowHours = DEFAULT_POLICY.partial_refund_hours,
): boolean {
  const checkInDate = parseISO(booking.check_in)
  const hoursUntilCheckIn = differenceInHours(checkInDate, now)
  return hoursUntilCheckIn <= windowHours
}
