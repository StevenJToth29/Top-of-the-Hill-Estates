import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const body = await request.json()

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.is_enabled !== undefined) fields.is_enabled = body.is_enabled
  if (body.fee_percent !== undefined) fields.fee_percent = body.fee_percent
  if (body.fee_flat !== undefined) fields.fee_flat = body.fee_flat

  const { error } = await supabase
    .from('payment_method_configs')
    .update(fields)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
