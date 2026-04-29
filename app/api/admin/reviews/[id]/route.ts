import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { approved } = await request.json()
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('reviews').update({ approved }).eq('id', params.id)
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('reviews').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}
