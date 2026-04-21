import type { BookingParams, RoomFee } from '@/types'
import { format, parseISO } from 'date-fns'

interface CheckoutSummaryProps {
  params: BookingParams
  roomName: string
  propertyName: string
  checkinTime?: string   // 24-hour "HH:mm"
  checkoutTime?: string  // 24-hour "HH:mm"
  processingFee?: number
}

function fmt12(time: string): string {
  try {
    const [h, m] = time.split(':').map(Number)
    const ampm = h < 12 ? 'AM' : 'PM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  } catch {
    return time
  }
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function CheckoutSummary({ params, roomName, propertyName, checkinTime, checkoutTime, processingFee = 0 }: CheckoutSummaryProps) {
  const isLongTerm = params.booking_type === 'long_term'
  const extraGuests = Math.max(0, params.guests - 1)
  const fees: RoomFee[] = params.fees ?? []
  const applicableFees = fees.filter(
    (f) => f.booking_type === params.booking_type || f.booking_type === 'both'
  )

  // Derive the actual nightly subtotal from total_amount rather than recalculating
  // from nightly_rate, so per-night price overrides are reflected correctly.
  const extraGuestTotal = extraGuests * params.extra_guest_fee * params.total_nights
  const genericFeesTotal = applicableFees.reduce((sum, f) => sum + f.amount, 0)
  const nightlySubtotal = params.total_amount - params.cleaning_fee - extraGuestTotal - genericFeesTotal
  const hasUniformRate = Math.abs(nightlySubtotal - params.total_nights * params.nightly_rate) < 0.01

  return (
    <div className="bg-surface-container rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-on-surface">{roomName}</h2>
        <p className="text-on-surface-variant text-sm mt-1">{propertyName}</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Check-in</span>
          <div className="text-right">
            <span className="text-on-surface">{formatDate(params.check_in)}</span>
            {!isLongTerm && checkinTime && (
              <p className="text-xs text-on-surface-variant/70 mt-0.5">after {fmt12(checkinTime)}</p>
            )}
          </div>
        </div>
        {!isLongTerm && (
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Check-out</span>
            <div className="text-right">
              <span className="text-on-surface">{formatDate(params.check_out)}</span>
              {checkoutTime && (
                <p className="text-xs text-on-surface-variant/70 mt-0.5">before {fmt12(checkoutTime)}</p>
              )}
            </div>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Guests</span>
          <span className="text-on-surface">{params.guests}</span>
        </div>
      </div>

      <div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
            isLongTerm ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'
          }`}
        >
          {isLongTerm ? 'Long-term' : 'Short-term'}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-on-surface-variant text-sm font-semibold uppercase tracking-wide">
          Price Breakdown
        </p>
        {isLongTerm ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">First month</span>
              <span className="text-on-surface">{formatCurrency(params.monthly_rate)}</span>
            </div>
            {params.security_deposit > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Security deposit</span>
                <span className="text-on-surface">{formatCurrency(params.security_deposit)}</span>
              </div>
            )}
            {extraGuests > 0 && params.extra_guest_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">
                  Extra guests ({extraGuests} × {formatCurrency(params.extra_guest_fee)}/month)
                </span>
                <span className="text-on-surface">
                  {formatCurrency(extraGuests * params.extra_guest_fee)}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">
                {params.total_nights} night{params.total_nights !== 1 ? 's' : ''}
                {hasUniformRate && <> × {formatCurrency(params.nightly_rate)}/night</>}
              </span>
              <span className="text-on-surface">
                {formatCurrency(nightlySubtotal)}
              </span>
            </div>
            {params.cleaning_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Cleaning fee</span>
                <span className="text-on-surface">{formatCurrency(params.cleaning_fee)}</span>
              </div>
            )}
            {extraGuests > 0 && params.extra_guest_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">
                  Extra guests ({extraGuests} × {formatCurrency(params.extra_guest_fee)}/night)
                </span>
                <span className="text-on-surface">
                  {formatCurrency(extraGuests * params.extra_guest_fee * params.total_nights)}
                </span>
              </div>
            )}
          </>
        )}
        {applicableFees.map((f) => (
          <div key={f.id} className="flex justify-between text-sm">
            <span className="text-on-surface-variant">{f.label}</span>
            <span className="text-on-surface">{formatCurrency(f.amount)}</span>
          </div>
        ))}
        {processingFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Processing fee</span>
            <span className="text-on-surface">{formatCurrency(processingFee)}</span>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-outline-variant">
        <div className="flex justify-between items-baseline">
          <span className="text-on-surface-variant text-sm font-semibold">Due today</span>
          <span className="text-primary font-bold text-3xl font-display">
            {formatCurrency(params.amount_to_pay + processingFee)}
          </span>
        </div>
        {params.amount_due_at_checkin > 0 && (
          <p className="text-on-surface-variant text-xs mt-1 text-right">
            + {formatCurrency(params.amount_due_at_checkin)} due at check-in
          </p>
        )}
        {processingFee > 0 ? (
          <p className="text-on-surface-variant/60 text-xs mt-2 text-right italic">
            Processing fees are non-refundable.
          </p>
        ) : (
          <p className="text-on-surface-variant/60 text-xs mt-2 text-right italic">
            Processing fee varies by payment method and is non-refundable.
          </p>
        )}
      </div>

      <div className="bg-surface-highest/40 rounded-xl p-4">
        <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wide mb-2">
          Cancellation Policy
        </p>
        <p className="text-on-surface-variant text-xs leading-relaxed">
          {isLongTerm
            ? 'Long-term reservations are non-refundable once confirmed. Contact us within 24 hours of booking for exceptions.'
            : 'Full refund if cancelled 7+ days before check-in. 50% refund 3–6 days before. No refund within 48 hours.'}
        </p>
      </div>
    </div>
  )
}
