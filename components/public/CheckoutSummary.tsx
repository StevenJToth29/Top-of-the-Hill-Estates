import { BookingParams } from '@/types'
import { format, parseISO } from 'date-fns'

interface CheckoutSummaryProps {
  params: BookingParams
  roomName: string
  propertyName: string
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function CheckoutSummary({ params, roomName, propertyName }: CheckoutSummaryProps) {
  const isLongTerm = params.booking_type === 'long_term'

  return (
    <div className="bg-surface-container rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-on-surface">{roomName}</h2>
        <p className="text-on-surface-variant text-sm mt-1">{propertyName}</p>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Check-in</span>
          <span className="text-on-surface">{formatDate(params.check_in)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Check-out</span>
          <span className="text-on-surface">{formatDate(params.check_out)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Guests</span>
          <span className="text-on-surface">{params.guests}</span>
        </div>
      </div>

      <div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
            isLongTerm
              ? 'bg-secondary/20 text-secondary'
              : 'bg-primary/20 text-primary'
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
              <span className="text-on-surface-variant">First month deposit</span>
              <span className="text-on-surface">{formatCurrency(params.monthly_rate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Balance due at check-in</span>
              <span className="text-on-surface">{formatCurrency(params.monthly_rate)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">
              {params.total_nights} night{params.total_nights !== 1 ? 's' : ''} ×{' '}
              {formatCurrency(params.nightly_rate)}/night
            </span>
            <span className="text-on-surface">{formatCurrency(params.total_amount)}</span>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-outline-variant">
        <div className="flex justify-between items-baseline">
          <span className="text-on-surface-variant text-sm font-semibold">Due today</span>
          <span className="text-primary font-bold text-3xl font-display">
            {formatCurrency(params.amount_to_pay)}
          </span>
        </div>
        {params.amount_due_at_checkin > 0 && (
          <p className="text-on-surface-variant text-xs mt-1 text-right">
            + {formatCurrency(params.amount_due_at_checkin)} due at check-in
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
