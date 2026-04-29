import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('task_automations')
    .select('*, room:rooms(name), property:properties(name), assignee:people(id,name)')
    .order('scope_type')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json()) as Record<string, unknown>
  if (!body.scope_type || !body.trigger_event || !body.title) {
    return NextResponse.json({ error: 'scope_type, trigger_event, and title are required' }, { status: 400 })
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('task_automations')
    .insert({
      scope_type: body.scope_type,
      room_id: body.room_id ?? null,
      property_id: body.property_id ?? null,
      trigger_event: body.trigger_event,
      title: body.title,
      description: body.description ?? null,
      day_offset: body.day_offset ?? 0,
      color: body.color ?? null,
      assignee_id: body.assignee_id ?? null,
      is_active: body.is_active ?? true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
