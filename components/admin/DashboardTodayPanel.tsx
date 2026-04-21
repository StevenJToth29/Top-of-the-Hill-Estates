import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { BookingWithRoom } from './RecentBookingsWidget'

interface Props {
  arrivals: BookingWithRoom[]
  departures: BookingWithRoom[]
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function GuestRow({ booking, type }: { booking: BookingWithRoom; type: 'in' | 'out' }) {
  const nights = differenceInCalendarDays(parseISO(booking.check_out), parseISO(booking.check_in))
  const outstanding = Math.max(0, (booking.total_amount ?? 0) - (booking.amount_paid ?? 0))
  const isIn = type === 'in'

  return (
    <div
      className="flex items-center gap-3 py-2.5"
      style={{ borderBottom: '1px solid #F8FAFC' }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-[800]"
        style={{
          fontFamily: 'Manrope, sans-serif',
          background: isIn ? 'rgba(45,212,191,0.08)' : 'rgba(217,119,6,0.08)',
          color: isIn ? '#1FB2A0' : '#D97706',
        }}
      >
        {initials(booking.guest_first_name, booking.guest_last_name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
          {booking.guest_first_name} {booking.guest_last_name}
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: '#94A3B8' }}>
          {booking.room?.name ?? '—'} · {nights} night{nights !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[13px] font-bold" style={{ color: '#0F172A' }}>
          ${(booking.total_amount ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </p>
        {outstanding > 0 ? (
          <p className="text-[11px] font-semibold" style={{ color: '#DC2626' }}>
            Owes ${outstanding.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        ) : (
          <p className="text-[11px]" style={{ color: '#059669' }}>Paid ✓</p>
        )}
      </div>
    </div>
  )
}

export default function DashboardTodayPanel({ arrivals, departures }: Props) {
  const hasAny = arrivals.length > 0 || departures.length > 0
  if (!hasAny) return null

  return (
    <div
      className="overflow-hidden rounded-xl border bg-white shadow-sm"
      style={{ borderColor: '#E2E8F0' }}
    >
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Check-ins */}
        <div className="p-4" style={{ borderRight: '1px solid #F1F5F9' }}>
          <div className="mb-3 flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[15px]"
              style={{ background: 'rgba(45,212,191,0.08)' }}
            >
              →
            </div>
            <div>
              <p className="font-display text-[13px] font-bold" style={{ color: '#0F172A' }}>
                Check-ins Today
              </p>
              <p className="text-[11px]" style={{ color: '#94A3B8' }}>
                {arrivals.length} guest{arrivals.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {arrivals.length === 0 ? (
            <p className="py-3 text-center text-[13px]" style={{ color: '#94A3B8' }}>
              No arrivals today
            </p>
          ) : (
            arrivals.map(b => <GuestRow key={b.id} booking={b} type="in" />)
          )}
        </div>

        {/* Check-outs */}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[15px]"
              style={{ background: 'rgba(217,119,6,0.08)' }}
            >
              ←
            </div>
            <div>
              <p className="font-display text-[13px] font-bold" style={{ color: '#0F172A' }}>
                Check-outs Today
              </p>
              <p className="text-[11px]" style={{ color: '#94A3B8' }}>
                {departures.length} guest{departures.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {departures.length === 0 ? (
            <p className="py-3 text-center text-[13px]" style={{ color: '#94A3B8' }}>
              No departures today
            </p>
          ) : (
            departures.map(b => <GuestRow key={b.id} booking={b} type="out" />)
          )}
        </div>
      </div>
    </div>
  )
}
