import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

interface RouteContext { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = (await request.json()) as Record<string, unknown>
  const allowed = ['title', 'description', 'day_offset', 'color', 'assignee_id', 'is_active', 'trigger_event', 'room_id', 'property_id', 'scope_type']
  const update = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('task_automations')
    .update(update)
    .eq('id', id)
    .select('*, room:rooms(name), property:properties(name), assignee:people(id,name)')
    .single()
  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('task_automations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
