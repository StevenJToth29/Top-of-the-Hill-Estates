import { parseISO } from 'date-fns'
import { generateICalFeed } from '@/lib/ical'
import { createServiceRoleClient } from '@/lib/supabase'
import { OPEN_ENDED_DATE } from '@/lib/format'

export async function GET(
  request: Request,
  { params }: { params: { token: string } },
) {
  const supabase = createServiceRoleClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('id, name, slug')
    .eq('ical_export_token', params.token)
    .single()

  if (!room) {
    return new Response('Not found', { status: 404 })
  }

  const [{ data: bookings }, { data: icalBlocks }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, check_in, check_out')
      .eq('room_id', room.id)
      .in('status', ['confirmed', 'pending']),
    supabase
      .from('ical_blocks')
      .select('event_uid, summary, start_date, end_date')
      .eq('room_id', room.id),
  ])

  const events = [
    ...(bookings ?? [])
      .filter(b => b.check_out !== OPEN_ENDED_DATE)
      .map(b => ({
        uid: `booking-${b.id}@tothrooms.com`,
        summary: `Reserved - ${room.name}`,
        // check_out is the day after the last night per iCal convention
        start: parseISO(b.check_in),
        end: parseISO(b.check_out),
        description: 'Booked via Top of the Hill Rooms',
      })),
    ...(icalBlocks ?? []).map(block => ({
      uid: block.event_uid,
      summary: block.summary || 'Blocked',
      start: parseISO(block.start_date),
      end: parseISO(block.end_date),
    })),
  ]

  return new Response(generateICalFeed(events), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${room.slug}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
