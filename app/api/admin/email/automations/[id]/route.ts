import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_automations')
    .select('*')
    .eq('id', params.id)
    .single()
  if (error || !data) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
  }
  return NextResponse.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await request.json()) as Record<string, unknown>
  const fields: Record<string, unknown> = {}
  if (body.name !== undefined) fields.name = body.name
  if (body.trigger_event !== undefined) fields.trigger_event = body.trigger_event
  if (body.is_active !== undefined) fields.is_active = body.is_active
  if (body.delay_minutes !== undefined) fields.delay_minutes = body.delay_minutes
  if (body.conditions !== undefined) fields.conditions = body.conditions
  if (body.template_id !== undefined) fields.template_id = body.template_id
  if (body.recipient_type !== undefined) fields.recipient_type = body.recipient_type
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_automations')
    .update(fields)
    .eq('id', params.id)
    .select()
    .single()
  if (error) {
    console.error('PUT email automation error:', error)
    return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()

  const { data: existing } = await supabase
    .from('email_automations')
    .select('is_pre_planned')
    .eq('id', params.id)
    .single()

  if ((existing as { is_pre_planned?: boolean } | null)?.is_pre_planned) {
    return NextResponse.json(
      { error: 'Cannot delete pre-planned automations' },
      { status: 403 },
    )
  }

  const { error } = await supabase
    .from('email_automations')
    .delete()
    .eq('id', params.id)

  if (error) {
    console.error('DELETE email automation error:', error)
    return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
