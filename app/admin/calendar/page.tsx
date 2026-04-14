import { format, addMonths } from 'date-fns'
import { createServiceRoleClient } from '@/lib/supabase'
import RoomsCalendar from '@/components/admin/RoomsCalendar'
import type { Room, Property, Booking, ICalBlock } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminCalendarPage() {
  const supabase = createServiceRoleClient()

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*, property:properties(name)')
    .eq('is_active', true)
    .order('name')

  const today = format(new Date(), 'yyyy-MM-dd')
  const threeMonthsOut = format(addMonths(new Date(), 3), 'yyyy-MM-dd')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, room_id, check_in, check_out, guest_first_name, guest_last_name, status')
    .in('status', ['confirmed', 'pending'])
    .gte('check_out', today)
    .lte('check_in', threeMonthsOut)

  const { data: icalBlocks } = await supabase
    .from('ical_blocks')
    .select('room_id, start_date, end_date, summary, platform')
    .gte('end_date', today)
    .lte('start_date', threeMonthsOut)

  const typedRooms = (rooms ?? []) as Array<Room & { property: Property }>
  const typedBookings = (bookings ?? []) as Booking[]
  const typedIcalBlocks = (icalBlocks ?? []) as ICalBlock[]

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-primary">
            Room Availability Calendar
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {typedRooms.length} active room{typedRooms.length !== 1 ? 's' : ''} ·{' '}
            {typedBookings.length} upcoming booking{typedBookings.length !== 1 ? 's' : ''} ·{' '}
            {typedIcalBlocks.length} iCal block{typedIcalBlocks.length !== 1 ? 's' : ''}
          </p>
        </div>

        <RoomsCalendar
          rooms={typedRooms}
          bookings={typedBookings}
          icalBlocks={typedIcalBlocks}
        />
      </div>
    </main>
  )
}
