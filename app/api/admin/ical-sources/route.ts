import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error } = await serverClient.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('ical_sources')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const body = await request.json()
  const { room_id, platform, ical_url } = body

  if (!room_id || !platform || !ical_url) {
    return NextResponse.json({ error: 'room_id, platform, and ical_url are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ical_sources')
    .insert({ room_id, platform, ical_url, is_active: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
