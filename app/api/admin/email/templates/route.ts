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
    .from('email_templates')
    .select('*')
    .order('name')
  if (error) {
    console.error('GET email templates error:', error)
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 })
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
    .from('email_templates')
    .insert(body)
    .select()
    .single()
  if (error) {
    console.error('POST email template error:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
