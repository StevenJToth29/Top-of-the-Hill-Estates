import { addDays, format } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getBlockedDatesForRoom } from '@/lib/availability'

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const supabase = await createServerSupabaseClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('*, property:properties(*)')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 })
  }

  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const ninetyDaysOut = format(addDays(now, 90), 'yyyy-MM-dd')

  const blockedDates = await getBlockedDatesForRoom(room.id, today, ninetyDaysOut)

  return Response.json({ room, blockedDates })
}
