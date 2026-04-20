import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_automations')
    .select('*')
    .order('is_pre_planned', { ascending: false })
    .order('name')
  if (error) {
    console.error('GET email automations error:', error)
    return NextResponse.json({ error: 'Failed to load automations' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await request.json()) as Record<string, unknown>
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_automations')
    .insert({ ...body, is_pre_planned: false })
    .select()
    .single()
  if (error) {
    console.error('POST email automation error:', error)
    return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
