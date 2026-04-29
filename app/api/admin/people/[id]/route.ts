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
  const body = (await request.json()) as { name?: string }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('people')
    .update({ name: body.name })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
