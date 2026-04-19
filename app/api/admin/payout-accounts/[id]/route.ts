import { NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'

interface RouteContext {
  params: { id: string }
}

async function requireAuth() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error } = await serverClient.auth.getUser()
  return error || !user ? null : user
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const fields: Record<string, string> = {}
  if (body.label !== undefined) fields.label = body.label.trim()
  if (body.stripe_account_id !== undefined) fields.stripe_account_id = body.stripe_account_id.trim()

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('stripe_accounts')
    .update(fields)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceRoleClient()

  // Check if any properties reference this account before deleting
  const { count } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('stripe_account_id', params.id)

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'Remove this payout account from all properties before deleting it.' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('stripe_accounts').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
