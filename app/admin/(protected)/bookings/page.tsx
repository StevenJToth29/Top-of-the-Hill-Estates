import { unstable_noStore as noStore } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase'
import BookingsClient from '@/components/admin/BookingsClient'
import BookingDetailPanel from '@/components/admin/BookingDetailPanel'
import { resolvePolicy } from '@/lib/cancellation'
import type { Booking, Room, Property, BookingModificationRequest, CancellationPolicy } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  noStore()
  const supabase = createServiceRoleClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, room:rooms(*, property:properties(*))')
    .order('created_at', { ascending: false })

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
      <BookingsClient
        bookings={(bookings ?? []) as Array<Booking & { room: Room & { property: Property } }>}
        selectedId={searchParams.id}
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
