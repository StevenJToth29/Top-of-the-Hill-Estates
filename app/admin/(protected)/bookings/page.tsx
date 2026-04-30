import { unstable_noStore as noStore } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase'
import BookingsClient from '@/components/admin/BookingsClient'
import BookingDetailPanel from '@/components/admin/BookingDetailPanel'
import BookingsPageTabs from '@/components/admin/BookingsPageTabs'
import ReviewsClient from '@/components/admin/ReviewsClient'
import { resolvePolicy } from '@/lib/cancellation'
import type { Booking, Room, Property, BookingModificationRequest, CancellationPolicy } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: { id?: string; tab?: string }
}) {
  noStore()
  const supabase = createServiceRoleClient()

  const [
    { data: bookings },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        `id, status, booking_type, check_in, check_out,
         guest_first_name, guest_last_name, guest_email,
         total_amount, amount_paid, processing_fee, source, created_at,
         room:rooms(name, property:properties(name))`,
      )
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('reviews')
      .select(
        'id, rating, comment, approved, created_at, booking:bookings(guest_first_name, guest_last_name, room:rooms(name))',
      )
      .order('created_at', { ascending: false }),
  ])

  let selectedBooking: (Booking & { room: Room & { property: Property } }) | null = null
  let selectedBookingModRequests: BookingModificationRequest[] = []
  if (searchParams.id) {
    const [{ data: bookingData }, { data: modData }] = await Promise.all([
      supabase
        .from('bookings')
        .select('*, room:rooms(*, property:properties(*))')
        .eq('id', searchParams.id)
        .single(),
      supabase
        .from('booking_modification_requests')
        .select('*')
        .eq('booking_id', searchParams.id)
        .order('created_at', { ascending: false }),
    ])
    selectedBooking = bookingData
    selectedBookingModRequests = (modData ?? []) as BookingModificationRequest[]
  }

  let selectedBookingPolicy: CancellationPolicy | null = null
  if (selectedBooking) {
    const { data: siteSettingsData } = await supabase
      .from('site_settings')
      .select('cancellation_policy')
      .maybeSingle()
    selectedBookingPolicy = resolvePolicy(
      selectedBooking.room,
      selectedBooking.room.property,
      siteSettingsData,
    )
  }

  return (
    <>
      <BookingsPageTabs
        bookingsContent={
          <BookingsClient
            bookings={(bookings ?? []) as unknown as Array<Booking & { room: Room & { property: Property } }>}
            selectedId={searchParams.id}
          />
        }
        reviewsContent={
          <ReviewsClient reviews={(reviews ?? []) as unknown as Parameters<typeof ReviewsClient>[0]['reviews']} />
        }
      />
      {selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          modificationRequests={selectedBookingModRequests}
          cancellationPolicy={selectedBookingPolicy ?? undefined}
        />
      )}
    </>
  )
}
