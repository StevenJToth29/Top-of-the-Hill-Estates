import { format } from 'date-fns/format'
import { parseISO } from 'date-fns/parseISO'
import type { Booking, Room, Property } from '@/types'
import { STATUS_BADGE } from '@/lib/format'

export type BookingWithRoom = Booking & {
  room: Room & { property: Property }
}

interface RecentBookingsWidgetProps {
  bookings: BookingWithRoom[]
}

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'MMM d, yyyy')
}

export function RecentBookingsWidget({ bookings }: RecentBookingsWidgetProps) {
  return (
    <div className="bg-surface-container rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(45,212,191,0.06)]">
      <div className="px-6 py-5">
        <h2 className="font-display text-lg font-semibold text-on-surface">
          Recent Bookings
        </h2>
      </div>

      {bookings.length === 0 ? (
        <div className="px-6 pb-6 text-on-surface-variant text-sm">
          No bookings yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Guest', 'Room', 'Check-in', 'Check-out', 'Type', 'Amount', 'Status'].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-6 py-3 text-left uppercase tracking-widest text-xs text-on-surface-variant font-medium whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="hover:bg-surface-high/40 transition-colors"
                >
                  <td className="px-6 py-4 text-on-surface whitespace-nowrap">
                    <a
                      href={`/admin/bookings?id=${booking.id}`}
                      className="hover:text-secondary transition-colors"
                    >
                      {booking.guest_first_name} {booking.guest_last_name}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                    <span className="block">{booking.room?.name ?? '—'}</span>
                    <span className="text-xs text-on-surface-variant/70">
                      {booking.room?.property?.name ?? ''}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                    {formatDate(booking.check_in)}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                    {formatDate(booking.check_out)}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap capitalize">
                    {booking.booking_type.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4 text-on-surface whitespace-nowrap">
                    ${booking.total_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[booking.status]}`}
                    >
                      {booking.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
