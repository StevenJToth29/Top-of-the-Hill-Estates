import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const body = await request.json()

  const fields: Record<string, unknown> = {
    about_text: body.about_text,
    contact_phone: body.contact_phone,
    contact_email: body.contact_email,
    contact_address: body.contact_address,
    business_name: body.business_name,
    updated_at: new Date().toISOString(),
  }
  if (body.logo_url !== undefined) fields.logo_url = body.logo_url
  if (body.logo_size !== undefined) fields.logo_size = body.logo_size
  if (body.business_hours !== undefined) fields.business_hours = body.business_hours
  if (body.global_house_rules !== undefined) fields.global_house_rules = body.global_house_rules

  let error
  if (body.id) {
    const result = await supabase
      .from('site_settings')
      .update(fields)
      .eq('id', body.id)
    error = result.error
  } else {
    const result = await supabase
      .from('site_settings')
      .insert(fields)
      .select('id')
      .single()
    error = result.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
