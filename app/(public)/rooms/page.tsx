import { createServerSupabaseClient } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/availability'
import RoomsFilter from '@/components/public/RoomsFilter'
import RoomsGrid, { type RoomWithProperty } from '@/components/public/RoomsGrid'

export interface SearchParams {
  guests?: string
  type?: string
  checkin?: string
  checkout?: string
}

export const metadata = {
  title: 'Browse Rooms — Top of the Hill Rooms',
  description:
    'Find short-term and long-term room rentals in Mesa/Tempe, Arizona.',
}

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createServerSupabaseClient()
  const { data: allRooms } = await supabase
    .from('rooms')
    .select('*, property:properties(*)')
    .eq('is_active', true)
    .order('name')

  const rooms = (allRooms ?? []) as RoomWithProperty[]

  let filtered = rooms.filter((room) => {
    if (searchParams.guests) {
      const requested = parseInt(searchParams.guests, 10)
      if (!isNaN(requested) && room.guest_capacity < requested) return false
    }
    if (searchParams.type === 'short_term' && !room.nightly_rate) return false
    if (searchParams.type === 'long_term' && !room.monthly_rate) return false
    return true
  })

  // Filter by date availability when both dates are provided
  if (searchParams.checkin && searchParams.checkout) {
    const availabilityResults = await Promise.all(
      filtered.map((room) =>
        isRoomAvailable(room.id, searchParams.checkin!, searchParams.checkout!),
      ),
    )
    filtered = filtered.filter((_, i) => availabilityResults[i])
  }

  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <div className="max-w-7xl mx-auto mb-12">
        <p className="uppercase tracking-widest text-sm text-secondary font-body mb-3">
          Mesa &amp; Tempe, AZ
        </p>
        <h1 className="font-display font-bold text-4xl md:text-5xl text-primary">
          Browse Rooms
        </h1>
      </div>

      <div className="max-w-7xl mx-auto mb-10">
        <RoomsFilter currentFilters={searchParams} />
      </div>

      <div className="max-w-7xl mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-body text-on-surface-variant text-lg">
              No rooms match your search. Try adjusting the filters.
            </p>
          </div>
        ) : (
          <RoomsGrid rooms={filtered} />
        )}
      </div>
    </main>
  )
}
