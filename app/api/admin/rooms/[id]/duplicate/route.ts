import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { slugify } from '@/lib/slugify'
import { randomUUID } from 'crypto'
import type { RoomFee } from '@/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const name: string = ((body.name as string) ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data: source, error: fetchError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !source) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  const { data: sourceFees } = await supabase
    .from('room_fees')
    .select('*')
    .eq('room_id', id)

  const { data: newRoom, error: insertError } = await supabase
    .from('rooms')
    .insert({
      property_id: source.property_id,
      name,
      slug: slugify(name),
      short_description: source.short_description,
      description: source.description,
      guest_capacity: source.guest_capacity,
      bedrooms: source.bedrooms,
      bathrooms: source.bathrooms,
      nightly_rate: source.nightly_rate,
      monthly_rate: source.monthly_rate,
      show_nightly_rate: source.show_nightly_rate,
      show_monthly_rate: source.show_monthly_rate,
      minimum_nights_short_term: source.minimum_nights_short_term,
      minimum_nights_long_term: source.minimum_nights_long_term,
      is_active: source.is_active,
      amenities: source.amenities,
      images: source.images,
      cleaning_fee: source.cleaning_fee,
      security_deposit: source.security_deposit,
      extra_guest_fee: source.extra_guest_fee,
      cancellation_window_hours: source.cancellation_window_hours,
      cancellation_policy: source.cancellation_policy,
      use_property_cancellation_policy: source.use_property_cancellation_policy,
      price_min: source.price_min,
      price_max: source.price_max,
      house_rules: source.house_rules,
      iframe_booking_url: source.iframe_booking_url ?? null,
      ical_export_token: randomUUID(),
    })
    .select('id')
    .single()

  if (insertError || !newRoom) {
    const isSlugConflict =
      insertError?.code === '23505' || insertError?.message?.includes('rooms_slug_key')
    if (isSlugConflict) {
      return NextResponse.json(
        { error: 'A room with this name already exists. Please choose a different name.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
  }

  if (sourceFees && sourceFees.length > 0) {
    const { error: feesError } = await supabase
      .from('room_fees')
      .insert(
        sourceFees.map((f: RoomFee) => ({
          room_id: newRoom.id,
          label: f.label,
          amount: f.amount,
          booking_type: f.booking_type,
        }))
      )
    if (feesError) {
      await supabase.from('rooms').delete().eq('id', newRoom.id)
      return NextResponse.json({ error: feesError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: newRoom.id })
}
