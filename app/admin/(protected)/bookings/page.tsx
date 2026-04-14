import { createServiceRoleClient } from '@/lib/supabase'
import BookingsTable from '@/components/admin/BookingsTable'
import BookingDetailPanel from '@/components/admin/BookingDetailPanel'
import NewManualBookingButton from '@/components/admin/NewManualBookingButton'
import type { Booking, Room, Property } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: { status?: string; property?: string; from?: string; to?: string; id?: string }
}) {
  const supabase = createServiceRoleClient()

  let query = supabase
    .from('bookings')
    .select('*, room:rooms(name, slug, property:properties(name))')
    .order('created_at', { ascending: false })

  if (searchParams.status) query = query.eq('status', searchParams.status)
  if (searchParams.from) query = query.gte('check_in', searchParams.from)
  if (searchParams.to) query = query.lte('check_out', searchParams.to)

  const { data: bookings } = await query

  let selectedBooking: (Booking & { room: Room & { property: Property } }) | null = null
  if (searchParams.id) {
    const { data } = await supabase
      .from('bookings')
      .select('*, room:rooms(*, property:properties(*))')
      .eq('id', searchParams.id)
      .single()
    selectedBooking = data
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-on-surface">Bookings</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Manage all guest reservations
            </p>
          </div>
          <NewManualBookingButton />
        </div>

        <BookingsTable
          bookings={
            (bookings ?? []) as Array<Booking & { room: Room & { property: Property } }>
          }
          selectedId={searchParams.id}
        />

        {selectedBooking && <BookingDetailPanel booking={selectedBooking} />}
      </div>
    </div>
  )
}
