import { createServiceRoleClient } from '@/lib/supabase'
import { isWithinCancellationWindow, calculateRefund } from '@/lib/cancellation'
import { getBlockedDatesForRoom } from '@/lib/availability'
import { addYears, addDays, eachDayOfInterval, parseISO, format } from 'date-fns'
import BookingManageView from '@/components/public/BookingManageView'
import type { Booking, Room, Property, BookingModificationRequest } from '@/types'

interface PageProps {
  searchParams: { booking_id?: string; guest_email?: string }
}

export default async function BookingManagePage({ searchParams }: PageProps) {
  const { booking_id, guest_email } = searchParams

  if (!booking_id || !guest_email) {
    return (
      <main className="min-h-screen bg-background py-16 px-4">
        <LookupForm error={null} />
      </main>
    )
  }

  const supabase = createServiceRoleClient()
  // Accept either the full UUID or the 8-char display prefix
  const prefix = booking_id.toLowerCase().slice(0, 8)

  const { data: bookingRaw } = await supabase
    .from('bookings')
    .select('*, room:rooms(*, property:properties(*))')
    .filter('id::text', 'ilike', `${prefix}%`)
    .ilike('guest_email', guest_email)
    .limit(1)
    .maybeSingle()

  if (!bookingRaw || !bookingRaw.room || !bookingRaw.room.property) {
    return (
      <main className="min-h-screen bg-background py-16 px-4">
        <LookupForm error="We couldn't find a booking with those details. Please check your confirmation email." />
      </main>
    )
  }

  const booking = bookingRaw as unknown as Booking & { room: Room & { property: Property } }
  const windowHours: number = booking.room.cancellation_window_hours ?? 72
  const now = new Date()
  const withinWindow = isWithinCancellationWindow(booking, now, windowHours)
  const refund = calculateRefund(booking, now, windowHours)

  // Fetch the most recent pending or rejected modification request
  const { data: modRequests } = await supabase
    .from('booking_modification_requests')
    .select('*')
    .eq('booking_id', booking.id)
    .in('status', ['pending', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(1)

  const latestRequest = (modRequests?.[0] ?? null) as BookingModificationRequest | null

  // Blocked dates for the modify date pickers (exclude current booking's own dates)
  let blockedDates: string[] = []
  if (!withinWindow && booking.status === 'confirmed') {
    const today = format(now, 'yyyy-MM-dd')
    const twoYearsOut = format(addYears(now, 2), 'yyyy-MM-dd')
    const allBlocked = await getBlockedDatesForRoom(booking.room_id, today, twoYearsOut)
    const currentDates = new Set(
      eachDayOfInterval({
        start: parseISO(booking.check_in),
        end: addDays(parseISO(booking.check_out), -1),
      }).map((d) => format(d, 'yyyy-MM-dd')),
    )
    blockedDates = allBlocked.filter((d) => !currentDates.has(d))
  }

  // Original fee snapshot total (used for client-side price preview)
  const { data: bookingFees } = await supabase
    .from('booking_fees')
    .select('amount')
    .eq('booking_id', booking.id)
  const genericFeesTotal = (bookingFees ?? []).reduce(
    (sum: number, f: { amount: number }) => sum + Number(f.amount),
    0,
  )

  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <BookingManageView
        booking={booking}
        windowHours={windowHours}
        withinWindow={withinWindow}
        refundAmount={refund.refund_amount}
        refundPercentage={refund.refund_percentage}
        policyDescription={refund.policy_description}
        latestRequest={latestRequest}
        blockedDates={blockedDates}
        genericFeesTotal={genericFeesTotal}
      />
    </main>
  )
}

function LookupForm({ error }: { error: string | null }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-surface-container rounded-2xl p-8 shadow-[0_8px_40px_rgba(45,212,191,0.06)]">
        <h1 className="font-display text-3xl font-bold text-primary mb-2">Manage Your Booking</h1>
        <p className="text-on-surface-variant font-body mb-6 text-sm">
          Enter the booking reference from your confirmation email and the email address you used to
          book.
        </p>
        {error && <p className="text-error text-sm mb-4 font-body">{error}</p>}
        <form method="GET" action="/booking/manage" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
              Booking Reference
            </label>
            <input
              name="booking_id"
              type="text"
              required
              placeholder="e.g. A1B2C3D4"
              className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50 font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
              Email Address
            </label>
            <input
              name="guest_email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold font-body"
          >
            Find My Booking
          </button>
        </form>
      </div>
    </div>
  )
}
