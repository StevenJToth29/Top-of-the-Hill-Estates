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
    .from('email_templates')
    .select('*')
    .eq('id', params.id)
    .single()
  if (error || !data) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
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
  if (body.subject !== undefined) fields.subject = body.subject
  if (body.body !== undefined) fields.body = body.body
  if (body.design !== undefined) fields.design = body.design
  if (body.is_active !== undefined) fields.is_active = body.is_active
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_templates')
    .update(fields)
    .eq('id', params.id)
    .select()
    .single()
  if (error) {
    console.error('PUT email template error:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
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
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', params.id)
  if (error) {
    console.error('DELETE email template error:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
