import { createServerSupabaseClient } from '@/lib/supabase'
import BookingConfirmation from '@/components/public/BookingConfirmation'
import type { Booking, Room, Property, BookingFee } from '@/types'

interface PageProps {
  searchParams: { booking_id?: string; guest_email?: string }
}

export default async function BookingConfirmationPage({ searchParams }: PageProps) {
  const bookingId = searchParams.booking_id
  const guestEmail = searchParams.guest_email

  if (!bookingId || !guestEmail) {
    return <NotFound />
  }

  const supabase = await createServerSupabaseClient()
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, room:rooms(*, property:properties(*))')
    .eq('id', bookingId)
    .ilike('guest_email', guestEmail)
    .single()

  if (error || !booking || !booking.room || !booking.room.property) {
    return <NotFound />
  }

  const typedBooking = booking as unknown as Booking & {
    room: Room & { property: Property }
  }

  const { data: bookingFees, error: feesError } = await supabase
    .from('booking_fees')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at')

  if (feesError) {
    console.error('Failed to fetch booking_fees:', feesError)
  }

  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <BookingConfirmation booking={typedBooking} bookingFees={(bookingFees ?? []) as BookingFee[]} />
    </main>
  )
}

function NotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="font-display text-3xl font-bold text-primary mb-4">Booking Not Found</h1>
        <p className="font-body text-on-surface-variant mb-8">
          We couldn&apos;t find a booking with that reference. Please check your confirmation email
          or contact us for assistance.
        </p>
        <a
          href="/rooms"
          className="inline-block bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold font-body"
        >
          Browse Rooms
        </a>
      </div>
    </main>
  )
}
