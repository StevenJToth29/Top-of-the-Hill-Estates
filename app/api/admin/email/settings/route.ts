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
  const { data, error } = await supabase.from('email_settings').select('*').maybeSingle()
  if (error) {
    console.error('GET email settings error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
  return NextResponse.json(data ?? {})
}

export async function PUT(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as Record<string, unknown>
  const supabase = createServiceRoleClient()

  const { data: existing } = await supabase
    .from('email_settings')
    .select('id')
    .maybeSingle()

  const { data, error } = existing
    ? await supabase
        .from('email_settings')
        .update(body)
        .eq('id', (existing as { id: string }).id)
        .select()
        .single()
    : await supabase
        .from('email_settings')
        .insert(body)
        .select()
        .single()

  if (error) {
    console.error('PUT email settings error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
  return NextResponse.json(data)
}
