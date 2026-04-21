import type { Metadata } from 'next'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'

export const metadata: Metadata = {
  title: 'Booking Confirmed',
  robots: { index: false, follow: false },
}
import BookingConfirmation from '@/components/public/BookingConfirmation'
import { resolvePolicy } from '@/lib/cancellation'
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

  const supabase = createServiceRoleClient()
  const publicSupabase = await createServerSupabaseClient()

  const [{ data: booking, error }, { data: settings }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, room:rooms(*, property:properties(*))')
      .eq('id', bookingId)
      .ilike('guest_email', guestEmail)
      .single(),
    publicSupabase
      .from('site_settings')
      .select('contact_phone, contact_email, cancellation_policy')
      .maybeSingle(),
  ])

  if (error || !booking || !booking.room || !booking.room.property) {
    return <NotFound />
  }

  const typedBooking = booking as unknown as Booking & {
    room: Room & { property: Property }
  }

  const resolvedPolicy = resolvePolicy(
    typedBooking.room,
    typedBooking.room.property,
    settings,
  )

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
      <BookingConfirmation
        booking={typedBooking}
        bookingFees={(bookingFees ?? []) as BookingFee[]}
        contactPhone={settings?.contact_phone ?? undefined}
        contactEmail={settings?.contact_email ?? undefined}
        cancellationPolicy={resolvedPolicy}
      />
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
