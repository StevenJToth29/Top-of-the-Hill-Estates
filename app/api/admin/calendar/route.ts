import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { expandRecurringTasks } from '@/lib/expand-recurring-tasks'

export async function GET(request: NextRequest) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from or to query params' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const [roomsRes, bookingsRes, icalRes, overridesRes, tasksRes] = await Promise.all([
    supabase
      .from('rooms')
      .select('*, property:properties(id, name)')
      .eq('is_active', true)
      .order('name'),

    supabase
      .from('bookings')
      .select('id, room_id, status, check_in, check_out, guest_first_name, guest_last_name, guest_email, guest_phone, booking_type, total_nights, total_amount, guest_count, source, notes')
      .in('status', ['confirmed', 'pending'])
      .lt('check_in', to)
      .gte('check_out', from),

    supabase
      .from('ical_blocks')
      .select('id, room_id, platform, start_date, end_date, last_synced_at')
      .lt('start_date', to)
      .gte('end_date', from),

    supabase
      .from('date_overrides')
      .select('id, room_id, date, price_override, is_blocked, block_reason, note, created_at')
      .gte('date', from)
      .lte('date', to),

    supabase
      .from('calendar_tasks')
      .select('*, assignee:people(id,name,ical_token,created_at,updated_at)')
      .or(`recurrence_rule.not.is.null,and(due_date.gte.${from},due_date.lte.${to})`),
  ])

  if (roomsRes.error) return NextResponse.json({ error: roomsRes.error.message }, { status: 500 })
  if (bookingsRes.error) return NextResponse.json({ error: bookingsRes.error.message }, { status: 500 })
  if (icalRes.error) return NextResponse.json({ error: icalRes.error.message }, { status: 500 })
  if (overridesRes.error) return NextResponse.json({ error: overridesRes.error.message }, { status: 500 })
  if (tasksRes.error) return NextResponse.json({ error: tasksRes.error.message }, { status: 500 })

  const exceptionsRes = await supabase
    .from('task_exceptions')
    .select('*')
    .gte('occurrence_date', from)
    .lte('occurrence_date', to)

  const fromDate = new Date(from + 'T00:00:00Z')
  const toDate = new Date(to + 'T23:59:59Z')

  const expandedTasks = expandRecurringTasks(
    tasksRes.data ?? [],
    exceptionsRes.data ?? [],
    fromDate,
    toDate,
  )

  return NextResponse.json({
    rooms: roomsRes.data ?? [],
    bookings: bookingsRes.data ?? [],
    icalBlocks: icalRes.data ?? [],
    dateOverrides: overridesRes.data ?? [],
    tasks: expandedTasks,
  })
}

