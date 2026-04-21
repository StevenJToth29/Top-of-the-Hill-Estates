import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

export async function PUT(request: NextRequest) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { room_id, dates, price_override, is_blocked, block_reason, note } = body

  if (!room_id || typeof room_id !== 'string') {
    return NextResponse.json({ error: 'Missing room_id' }, { status: 400 })
  }
  if (!Array.isArray(dates) || dates.length === 0 || !(dates as unknown[]).every((d) => typeof d === 'string')) {
    return NextResponse.json({ error: 'dates must be a non-empty array of date strings' }, { status: 400 })
  }

  const rows = (dates as string[]).map((date) => ({
    room_id,
    date,
    price_override: typeof price_override === 'number' ? price_override : null,
    is_blocked: is_blocked === true,
    block_reason: typeof block_reason === 'string' ? block_reason : null,
    note: typeof note === 'string' ? note : null,
  }))

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('date_overrides')
    .upsert(rows, { onConflict: 'room_id,date' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated: rows.length })
}
