import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/availability'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const propertyFilter = searchParams.get('property')
  const guestsFilter = searchParams.get('guests')
  const checkin = searchParams.get('checkin')
  const checkout = searchParams.get('checkout')

  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('rooms')
    .select('*, property:properties(*)')
    .eq('is_active', true)
    .order('name')

  if (guestsFilter) {
    query = query.gte('guest_capacity', parseInt(guestsFilter))
  }

  const { data: rooms, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  let filteredRooms = (rooms ?? []).filter(
    (room) => !propertyFilter || room.property?.name === propertyFilter,
  )

  if (checkin && checkout) {
    const available = await Promise.all(
      filteredRooms.map((room) => isRoomAvailable(room.id, checkin, checkout)),
    )
    filteredRooms = filteredRooms.filter((_, i) => available[i])
  }

  return Response.json({ rooms: filteredRooms })
}
