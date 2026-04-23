import { differenceInDays, parseISO, eachDayOfInterval, addDays, format } from 'date-fns'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { getAvailableRoomIds } from '@/lib/availability'
import RoomsFilter from '@/components/public/RoomsFilter'
import RoomsGrid, { type RoomWithProperty, type RoomRateInfo } from '@/components/public/RoomsGrid'

export interface SearchParams {
  guests?: string
  type?: string
  checkin?: string
  checkout?: string
  max_price?: string
  amenities?: string
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

  let query = supabase
    .from('rooms')
    .select('*, property:properties(*), fees:room_fees(*)')
    .eq('is_active', true)

  // Push capacity, type, and price filters to the database
  if (searchParams.guests) {
    const requested = parseInt(searchParams.guests, 10)
    if (!isNaN(requested)) {
      query = query.gte('guest_capacity', requested)
    }
  }

  if (searchParams.type === 'short_term') {
    query = query.not('nightly_rate', 'is', null)
    if (searchParams.max_price) {
      const maxPrice = parseFloat(searchParams.max_price)
      if (!isNaN(maxPrice)) {
        query = query.lte('nightly_rate', maxPrice)
      }
    }
  } else if (searchParams.type === 'long_term') {
    query = query.not('monthly_rate', 'is', null)
    if (searchParams.max_price) {
      const maxPrice = parseFloat(searchParams.max_price)
      if (!isNaN(maxPrice)) {
        query = query.lte('monthly_rate', maxPrice)
      }
    }
  } else if (searchParams.max_price) {
    // No type filter — apply max_price against nightly_rate as a best-effort default
    const maxPrice = parseFloat(searchParams.max_price)
    if (!isNaN(maxPrice)) {
      query = query.lte('nightly_rate', maxPrice)
    }
  }

  query = query.order('name')

  const { data: allRooms } = await query

  const rooms = (allRooms ?? []) as RoomWithProperty[]

  // Amenities filter cannot be pushed to Supabase (JS array-contains check)
  let filtered = rooms.filter((room) => {
    if (searchParams.amenities) {
      const required = searchParams.amenities.split(',').map((a) => a.trim()).filter(Boolean)
      if (required.length > 0 && !required.every((a) => room.amenities?.includes(a))) return false
    }
    return true
  })

  // Filter by date availability — single batch query instead of one per room
  if (searchParams.checkin && searchParams.checkout) {
    const availableIds = await getAvailableRoomIds(
      filtered.map((r) => r.id),
      searchParams.checkin,
      searchParams.checkout,
    )
    filtered = filtered.filter((r) => availableIds.has(r.id))
  }

  // Calculate per-room totals (nightly + cleaning + fees) when dates are selected
  let roomRates: Record<string, RoomRateInfo> = {}
  if (searchParams.checkin && searchParams.checkout && filtered.length > 0) {
    const checkinDate = parseISO(searchParams.checkin)
    const checkoutDate = parseISO(searchParams.checkout)
    const nights = differenceInDays(checkoutDate, checkinDate)

    if (nights > 0) {
      const roomIds = filtered.map((r) => r.id)
      const serviceSupabase = createServiceRoleClient()
      const { data: overrides } = await serviceSupabase
        .from('date_overrides')
        .select('room_id, date, price_override')
        .in('room_id', roomIds)
        .gte('date', searchParams.checkin)
        .lt('date', searchParams.checkout)
        .not('price_override', 'is', null)

      const overrideMap: Record<string, Record<string, number>> = {}
      for (const o of overrides ?? []) {
        if (o.price_override != null) {
          if (!overrideMap[o.room_id]) overrideMap[o.room_id] = {}
          overrideMap[o.room_id][o.date] = Number(o.price_override)
        }
      }

      const allDates = eachDayOfInterval({
        start: checkinDate,
        end: addDays(checkoutDate, -1),
      }).map((d) => format(d, 'yyyy-MM-dd'))

      const guests = searchParams.guests ? Math.max(1, parseInt(searchParams.guests, 10)) : 1

      for (const room of filtered) {
        const roomOverrides = overrideMap[room.id] ?? {}

        // Nightly subtotal with date overrides
        let nightlySubtotal = 0
        for (const date of allDates) {
          nightlySubtotal += roomOverrides[date] ?? room.nightly_rate
        }

        const cleaningFee = room.cleaning_fee ?? 0
        const extraGuestFee = room.extra_guest_fee ?? 0
        const extraGuests = Math.max(0, guests - 1)
        const extraGuestTotal = extraGuests * extraGuestFee * nights

        const genericFees = (room.fees ?? [])
          .filter((f) => f.booking_type === 'short_term' || f.booking_type === 'both')
          .reduce((sum, f) => sum + Number(f.amount), 0)

        const total = nightlySubtotal + cleaningFee + extraGuestTotal + genericFees

        roomRates[room.id] = { nightlySubtotal, total, nights }
      }
    }
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
          <RoomsGrid
            rooms={filtered}
            searchContext={{
              checkin: searchParams.checkin,
              checkout: searchParams.checkout,
              guests: searchParams.guests,
            }}
            roomRates={roomRates}
          />
        )}
      </div>
    </main>
  )
}
