import { createServiceRoleClient } from '@/lib/supabase'
import { isWithinCancellationWindow, calculateRefund, resolvePolicy } from '@/lib/cancellation'
import { getBlockedDatesForRoom } from '@/lib/availability'
import { addYears, addDays, eachDayOfInterval, parseISO, format } from 'date-fns'
import BookingManageView from '@/components/public/BookingManageView'
import BookingLookupForm from '@/components/public/BookingLookupForm'
import type { Booking, Room, Property, BookingModificationRequest } from '@/types'

interface PageProps {
  searchParams: { booking_id?: string; guest_email?: string; check_in?: string }
}

export default async function BookingManagePage({ searchParams }: PageProps) {
  const { booking_id, guest_email, check_in } = searchParams

  const hasReference = booking_id && guest_email
  const hasEmailDate = guest_email && check_in && !booking_id

  if (!hasReference && !hasEmailDate) {
    return (
      <main className="min-h-screen bg-background py-16 px-4">
        <BookingLookupForm error={null} />
      </main>
    )
  }

  const supabase = createServiceRoleClient()

  let bookingQuery = supabase
    .from('bookings')
    .select('*, room:rooms(*, property:properties(*))')

  if (hasReference) {
    const prefix = booking_id.toLowerCase().slice(0, 8)
    bookingQuery = bookingQuery
      .filter('id::text', 'ilike', `${prefix}%`)
      .ilike('guest_email', guest_email)
  } else {
    bookingQuery = bookingQuery
      .ilike('guest_email', guest_email!)
      .eq('check_in', check_in!)
      .order('created_at', { ascending: false })
  }

  const { data: bookingRaw } = await bookingQuery.limit(1).maybeSingle()

  if (!bookingRaw || !bookingRaw.room || !bookingRaw.room.property) {
    return (
      <main className="min-h-screen bg-background py-16 px-4">
        <BookingLookupForm error="We couldn't find a booking with those details. Please double-check your information." />
      </main>
    )
  }

  const booking = bookingRaw as unknown as Booking & { room: Room & { property: Property } }

  const { data: siteSettings } = await supabase
    .from('site_settings')
    .select('cancellation_policy')
    .maybeSingle()

  const resolvedPolicy = resolvePolicy(booking.room, booking.room.property, siteSettings)
  const now = new Date()
  const withinWindow = isWithinCancellationWindow(booking, now, resolvedPolicy.partial_refund_hours)
  const refund = calculateRefund(booking, now, resolvedPolicy)

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
        windowHours={resolvedPolicy.partial_refund_hours}
        withinWindow={withinWindow}
        refundAmount={refund.refund_amount}
        refundPercentage={refund.refund_percentage}
        policyDescription={refund.policy_description}
        cancellationPolicy={resolvedPolicy}
        latestRequest={latestRequest}
        blockedDates={blockedDates}
        genericFeesTotal={genericFeesTotal}
      />
    </main>
  )
}

