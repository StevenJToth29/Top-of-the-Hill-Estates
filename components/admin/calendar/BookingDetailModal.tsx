'use client'

import { format } from 'date-fns'
import { ModalShell } from './ModalShell'
import type { Booking } from '@/types'

const SOURCE_COLORS: Record<string, string> = {
  airbnb: '#FF5A5F',
  vrbo: '#3D67FF',
  direct: '#2DD4BF',
  'booking.com': '#003580',
}

interface BookingDetailModalProps {
  booking: Booking
  onClose: () => void
  onEdit: (bookingId: string) => void
  onViewFull: (bookingId: string) => void
  onCancelBooking: (bookingId: string) => void
}

export function BookingDetailModal({
  booking,
  onClose,
  onEdit,
  onViewFull,
  onCancelBooking,
}: BookingDetailModalProps) {
  const initials = `${booking.guest_first_name[0] ?? ''}${booking.guest_last_name[0] ?? ''}`.toUpperCase()
  const source = booking.source ?? 'direct'
  const sourceColor = SOURCE_COLORS[source.toLowerCase()] ?? '#94A3B8'

  const checkIn = format(new Date(booking.check_in + 'T00:00:00'), 'MMM d, yyyy')
  const checkOut = format(new Date(booking.check_out + 'T00:00:00'), 'MMM d, yyyy')

  return (
    <ModalShell title="Booking Details" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ background: '#2DD4BF' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800">
              {booking.guest_first_name} {booking.guest_last_name}
            </p>
            <p className="text-xs text-slate-500 truncate">{booking.guest_email}</p>
            <p className="text-xs text-slate-500">{booking.guest_phone}</p>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full text-white shrink-0"
            style={{ background: sourceColor }}>
            {source}
          </span>
        </div>

        <div className="rounded-xl bg-slate-50 divide-y divide-slate-100 text-sm">
          {[
            { label: 'Check-in', value: checkIn },
            { label: 'Check-out', value: checkOut },
            { label: 'Duration', value: `${booking.total_nights} nights` },
            { label: 'Guests', value: String(booking.guest_count) },
            { label: 'Type', value: booking.booking_type === 'short_term' ? 'Short-term' : 'Long-term' },
            { label: 'Total', value: `$${booking.total_amount.toLocaleString()}` },
            { label: 'Status', value: booking.status },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between px-3 py-2">
              <span className="text-slate-500">{label}</span>
              <span className="font-medium text-slate-800 capitalize">{value}</span>
            </div>
          ))}
        </div>

        {booking.notes && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
            <strong>Notes:</strong> {booking.notes}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => onCancelBooking(booking.id)}
            className="px-4 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors">
            Cancel Booking
          </button>
          <button type="button" onClick={() => onViewFull(booking.id)}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors">
            View
          </button>
          <button type="button" onClick={() => onEdit(booking.id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: '#2DD4BF' }}>
            ✏ Edit
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
