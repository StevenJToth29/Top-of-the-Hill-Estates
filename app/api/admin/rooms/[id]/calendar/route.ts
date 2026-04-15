import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'Missing from/to' }, { status: 400 })

  const supabase = createServiceRoleClient()

  const [{ data: bookings }, { data: icalBlocks }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, room_id, check_in, check_out, guest_first_name, guest_last_name, status')
      .eq('room_id', params.id)
      .in('status', ['confirmed', 'pending'])
      .lte('check_in', to)
      .gte('check_out', from),
    supabase
      .from('ical_blocks')
      .select('id, room_id, start_date, end_date, summary, platform')
      .eq('room_id', params.id)
      .lte('start_date', to)
      .gte('end_date', from),
  ])

  return NextResponse.json({ bookings: bookings ?? [], icalBlocks: icalBlocks ?? [] })
}
