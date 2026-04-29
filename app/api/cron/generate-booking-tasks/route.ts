import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { generateTasksForDateTrigger, generateTasksForICalBlock } from '@/lib/task-automation'
import { timingSafeCompare } from '@/lib/timing-safe-compare'

const LOOKAHEAD_DAYS = 14

export async function GET(request: NextRequest) {
  if (!timingSafeCompare(request.headers.get('Authorization') ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const lookahead = new Date(today)
  lookahead.setUTCDate(lookahead.getUTCDate() + LOOKAHEAD_DAYS)
  const lookaheadStr = lookahead.toISOString().slice(0, 10)

  const [{ data: bookingsCheckin }, { data: bookingsCheckout }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, check_in, check_out, room_id, room:rooms(property_id)')
      .eq('status', 'confirmed')
      .gte('check_in', todayStr)
      .lte('check_in', lookaheadStr),
    supabase
      .from('bookings')
      .select('id, check_in, check_out, room_id, room:rooms(property_id)')
      .eq('status', 'confirmed')
      .gte('check_out', todayStr)
      .lte('check_out', lookaheadStr),
  ])

  const [{ data: blocksStart }, { data: blocksEnd }] = await Promise.all([
    supabase
      .from('ical_blocks')
      .select('id, start_date, end_date, room_id, room:rooms(property_id)')
      .gte('start_date', todayStr)
      .lte('start_date', lookaheadStr),
    supabase
      .from('ical_blocks')
      .select('id, start_date, end_date, room_id, room:rooms(property_id)')
      .gte('end_date', todayStr)
      .lte('end_date', lookaheadStr),
  ])

  let bookingTasksCreated = 0
  let icalTasksCreated = 0

  await Promise.all(
    (bookingsCheckin ?? []).map(async (b) => {
      const propertyId = (b.room as unknown as { property_id: string } | null)?.property_id
      if (!propertyId) return
      await generateTasksForDateTrigger(b.id, 'checkin_day', b.check_in, b.check_out, b.room_id, propertyId)
      bookingTasksCreated++
    }),
  )

  await Promise.all(
    (bookingsCheckout ?? []).map(async (b) => {
      const propertyId = (b.room as unknown as { property_id: string } | null)?.property_id
      if (!propertyId) return
      await generateTasksForDateTrigger(b.id, 'checkout', b.check_in, b.check_out, b.room_id, propertyId)
      bookingTasksCreated++
    }),
  )

  await Promise.all(
    (blocksStart ?? []).map(async (block) => {
      const propertyId = (block.room as unknown as { property_id: string } | null)?.property_id
      if (!propertyId) return
      await generateTasksForICalBlock(block.id, 'checkin_day', block.start_date, block.end_date, block.room_id, propertyId)
      icalTasksCreated++
    }),
  )

  await Promise.all(
    (blocksEnd ?? []).map(async (block) => {
      const propertyId = (block.room as unknown as { property_id: string } | null)?.property_id
      if (!propertyId) return
      await generateTasksForICalBlock(block.id, 'checkout', block.start_date, block.end_date, block.room_id, propertyId)
      icalTasksCreated++
    }),
  )

  return NextResponse.json({ booking_tasks: bookingTasksCreated, ical_tasks: icalTasksCreated })
}
