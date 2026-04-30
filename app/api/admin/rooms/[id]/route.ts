import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { runSmartPricingForRoomById } from '@/lib/smart-pricing-runner'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_request: NextRequest, { params }: Params) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('rooms').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Narrow allowlist: this route is used only by SmartPricingModal for price range / smart pricing updates.
  // Full room edits go through the room form at /admin/rooms/[id]/edit.
  const allowed = ['price_min', 'price_max', 'smart_pricing_enabled', 'smart_pricing_aggressiveness', 'is_active']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const supabase = createServiceRoleClient()

  // Fetch current smart_pricing_enabled to detect transitions
  const { data: current } = await supabase
    .from('rooms')
    .select('smart_pricing_enabled')
    .eq('id', id)
    .single()
  const wasEnabled = current?.smart_pricing_enabled === true
  const willEnable = body.smart_pricing_enabled === true
  const willDisable = body.smart_pricing_enabled === false

  const { data: room, error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (willDisable && wasEnabled) {
    // Revert-on-disable: clear all engine-generated overrides immediately
    await supabase
      .from('date_overrides')
      .delete()
      .eq('room_id', id)
      .eq('source', 'smart')
  } else if (willEnable || (wasEnabled && ('price_min' in updates || 'price_max' in updates || 'smart_pricing_aggressiveness' in updates))) {
    // Await so the response only returns after prices are written — caller can refresh the calendar immediately
    await runSmartPricingForRoomById(id).catch((err) => {
      console.error(`smart-pricing immediate run failed for room ${id}:`, err)
    })
  }

  return NextResponse.json({ room })
}
