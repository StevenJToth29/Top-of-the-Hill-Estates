import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/availability'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_STAY_DAYS = 365

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const propertyFilter = searchParams.get('property')
  const guestsFilter = searchParams.get('guests')
  const checkin = searchParams.get('checkin')
  const checkout = searchParams.get('checkout')

  if (checkin && checkout) {
    if (!DATE_RE.test(checkin) || !DATE_RE.test(checkout)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    const checkinDate = new Date(checkin)
    const checkoutDate = new Date(checkout)
    if (checkoutDate <= checkinDate) {
      return NextResponse.json({ error: 'checkout must be after checkin' }, { status: 400 })
    }
    const stayDays = (checkoutDate.getTime() - checkinDate.getTime()) / 86_400_000
    if (stayDays > MAX_STAY_DAYS) {
      return NextResponse.json({ error: 'Date range too large' }, { status: 400 })
    }
  }

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
