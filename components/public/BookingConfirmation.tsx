import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import type { Booking, Room, Property } from '@/types'

type BookingWithRoom = Booking & {
  room: Room & { property: Property }
}

function formatDate(dateStr: string): string {
  return format(new Date(dateStr + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

function truncateId(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

const SHORT_TERM_POLICY =
  'Full refund if cancelled more than 7 days before check-in. 50% refund if cancelled more than 72 hours but within 7 days. No refund within 72 hours of check-in.'
const LONG_TERM_POLICY =
  'Deposit is non-refundable. Please review your lease agreement for full cancellation terms.'

export default function BookingConfirmation({ booking }: { booking: BookingWithRoom }) {
  const { room } = booking
  const property = room.property
  const isLongTerm = booking.booking_type === 'long_term'
  const cancellationPolicy = isLongTerm ? LONG_TERM_POLICY : SHORT_TERM_POLICY

  return (
    <div className="max-w-2xl mx-auto bg-surface-container rounded-2xl p-8 shadow-[0_8px_40px_rgba(78,205,196,0.06)]">
      <div className="text-center mb-8">
        <CheckCircleIcon className="w-16 h-16 text-secondary mx-auto mb-4" />
        <h1 className="font-display text-4xl font-bold text-primary">Booking Confirmed!</h1>
        <p className="text-on-surface-variant mt-2 font-body">
          Reference:{' '}
          <span className="font-semibold text-secondary tracking-widest">
            #{truncateId(booking.id)}
          </span>
        </p>
      </div>

      <section className="mb-6">
        <h2 className="font-display text-lg font-semibold text-primary mb-3">Guest Information</h2>
        <div className="space-y-1 font-body text-on-surface-variant">
          <p>
            <span className="text-on-surface">
              {booking.guest_first_name} {booking.guest_last_name}
            </span>
          </p>
          <p>{booking.guest_email}</p>
          {booking.guest_phone && <p>{booking.guest_phone}</p>}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-display text-lg font-semibold text-primary mb-3">Room Details</h2>
        <div className="space-y-1 font-body text-on-surface-variant">
          <p className="text-on-surface font-semibold">{room.name}</p>
          <p>{property.name}</p>
          <p>
            {property.address}, {property.city}, {property.state}
          </p>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-display text-lg font-semibold text-primary mb-3">Stay Dates</h2>
        <div className="grid grid-cols-2 gap-4 font-body">
          <div>
            <p className="text-on-surface-variant text-sm mb-1">Check-in</p>
            <p className="text-on-surface font-medium">{formatDate(booking.check_in)}</p>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm mb-1">Check-out</p>
            <p className="text-on-surface font-medium">{formatDate(booking.check_out)}</p>
          </div>
        </div>
        <p className="text-on-surface-variant text-sm mt-3 font-body">
          {booking.total_nights} night{booking.total_nights !== 1 ? 's' : ''}
        </p>
      </section>

      <div className="mb-6">
        <span
          className={`inline-block rounded-xl px-4 py-1.5 text-sm font-semibold font-body ${
            isLongTerm
              ? 'bg-secondary/20 text-secondary'
              : 'bg-primary/20 text-primary'
          }`}
        >
          {isLongTerm ? 'Long-term Stay' : 'Short-term Stay'}
        </span>
      </div>

      <section className="mb-6 bg-surface-high/40 rounded-xl p-5">
        <h2 className="font-display text-lg font-semibold text-primary mb-3">Payment Summary</h2>
        <div className="space-y-2 font-body">
          <div className="flex justify-between text-on-surface-variant">
            <span>Total amount</span>
            <span>{formatCurrency(booking.total_amount)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-on-surface-variant">Paid today</span>
            <span className="text-primary font-bold text-xl">
              {formatCurrency(booking.amount_paid)}
            </span>
          </div>
          {booking.amount_due_at_checkin > 0 && (
            <div className="flex justify-between items-baseline pt-2 border-t border-outline-variant">
              <span className="text-secondary text-sm">Due at check-in</span>
              <span className="text-secondary font-semibold">
                {formatCurrency(booking.amount_due_at_checkin)}
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-display text-lg font-semibold text-primary mb-2">
          Cancellation Policy
        </h2>
        <p className="font-body text-on-surface-variant text-sm leading-relaxed">
          {cancellationPolicy}
        </p>
      </section>

      <section className="mb-8">
        <p className="font-body text-on-surface-variant text-sm">
          Questions? Contact us at{' '}
          <a href="tel:+14805550000" className="text-secondary hover:underline">
            (480) 555-0000
          </a>{' '}
          or{' '}
          <a href="mailto:info@tothrooms.com" className="text-secondary hover:underline">
            info@tothrooms.com
          </a>
        </p>
      </section>

      <div className="text-center">
        <a
          href="/rooms"
          className="inline-block bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold font-body"
        >
          Browse More Rooms
        </a>
      </div>
    </div>
  )
}
