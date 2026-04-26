import { NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'

async function getAuthedUser() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error } = await serverClient.auth.getUser()
  return { user: error ? null : user }
}

export async function POST(request: Request) {
  const { user } = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceRoleClient()
  const body = await request.json()

  const cleaningFee = Number(body.cleaning_fee ?? 0)
  const securityDeposit = Number(body.security_deposit ?? 0)
  const extraGuestFee = Number(body.extra_guest_fee ?? 0)
  if (isNaN(cleaningFee) || cleaningFee < 0 || isNaN(securityDeposit) || securityDeposit < 0 || isNaN(extraGuestFee) || extraGuestFee < 0) {
    return NextResponse.json({ error: 'Fee amounts must be non-negative numbers' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      property_id: body.property_id,
      name: body.name,
      slug: body.slug,
      short_description: body.short_description ?? '',
      description: body.description ?? '',
      guest_capacity: Number(body.guest_capacity),
      bedrooms: Number(body.bedrooms),
      bathrooms: Number(body.bathrooms),
      nightly_rate: Number(body.nightly_rate),
      monthly_rate: Number(body.monthly_rate),
      show_nightly_rate: Boolean(body.show_nightly_rate),
      show_monthly_rate: Boolean(body.show_monthly_rate),
      minimum_nights_short_term: Number(body.minimum_nights_short_term),
      minimum_nights_long_term: Number(body.minimum_nights_long_term),
      is_active: Boolean(body.is_active),
      amenities: body.amenities ?? [],
      images: body.images ?? [],
      cleaning_fee: cleaningFee,
      cleaning_fee_calculation_type: body.cleaning_fee_calculation_type ?? 'fixed',
      cleaning_fee_booking_type: body.cleaning_fee_booking_type ?? 'both',
      security_deposit: securityDeposit,
      security_deposit_calculation_type: body.security_deposit_calculation_type ?? 'fixed',
      security_deposit_booking_type: body.security_deposit_booking_type ?? 'both',
      extra_guest_fee: extraGuestFee,
      extra_guest_fee_calculation_type: body.extra_guest_fee_calculation_type ?? 'per_guest',
      extra_guest_fee_booking_type: body.extra_guest_fee_booking_type ?? 'both',
      cancellation_window_hours: Number(body.cancellation_window_hours ?? 72),
      cancellation_policy: body.cancellation_policy ?? null,
      use_property_cancellation_policy: body.use_property_cancellation_policy ?? true,
      iframe_booking_url: body.iframe_booking_url || null,
      airbnb_listing_id: body.airbnb_listing_id || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const fees: { label: string; amount: number; calculation_type: 'fixed' | 'per_guest' | 'percent'; booking_type: 'short_term' | 'long_term' | 'both' }[] = body.fees ?? []
  const validBookingTypes = new Set(['short_term', 'long_term', 'both'])
  const validCalcTypes = new Set(['fixed', 'per_guest', 'percent'])
  if (fees.some((f) => !validBookingTypes.has(f.booking_type))) {
    return NextResponse.json({ error: 'Invalid booking_type — must be short_term, long_term, or both' }, { status: 400 })
  }
  if (fees.some((f) => !validCalcTypes.has(f.calculation_type))) {
    return NextResponse.json({ error: 'Invalid calculation_type — must be fixed, per_guest, or percent' }, { status: 400 })
  }
  if (fees.length > 0) {
    const { error: feesError } = await supabase
      .from('room_fees')
      .insert(fees.map((f) => ({ room_id: data.id, label: f.label, amount: f.amount, calculation_type: f.calculation_type, booking_type: f.booking_type })))
    if (feesError) return NextResponse.json({ error: feesError.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}

export async function PATCH(request: Request) {
  const { user } = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceRoleClient()
  const body = await request.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'Missing room id' }, { status: 400 })

  const cleaningFee = Number(fields.cleaning_fee ?? 0)
  const securityDeposit = Number(fields.security_deposit ?? 0)
  const extraGuestFee = Number(fields.extra_guest_fee ?? 0)
  if (isNaN(cleaningFee) || cleaningFee < 0 || isNaN(securityDeposit) || securityDeposit < 0 || isNaN(extraGuestFee) || extraGuestFee < 0) {
    return NextResponse.json({ error: 'Fee amounts must be non-negative numbers' }, { status: 400 })
  }

  const { error } = await supabase
    .from('rooms')
    .update({
      name: fields.name,
      slug: fields.slug,
      short_description: fields.short_description,
      description: fields.description,
      guest_capacity: Number(fields.guest_capacity),
      bedrooms: Number(fields.bedrooms),
      bathrooms: Number(fields.bathrooms),
      nightly_rate: Number(fields.nightly_rate),
      monthly_rate: Number(fields.monthly_rate),
      show_nightly_rate: Boolean(fields.show_nightly_rate),
      show_monthly_rate: Boolean(fields.show_monthly_rate),
      minimum_nights_short_term: Number(fields.minimum_nights_short_term),
      minimum_nights_long_term: Number(fields.minimum_nights_long_term),
      is_active: Boolean(fields.is_active),
      amenities: fields.amenities,
      images: fields.images,
      cleaning_fee: cleaningFee,
      cleaning_fee_calculation_type: fields.cleaning_fee_calculation_type ?? 'fixed',
      cleaning_fee_booking_type: fields.cleaning_fee_booking_type ?? 'both',
      security_deposit: securityDeposit,
      security_deposit_calculation_type: fields.security_deposit_calculation_type ?? 'fixed',
      security_deposit_booking_type: fields.security_deposit_booking_type ?? 'both',
      extra_guest_fee: extraGuestFee,
      extra_guest_fee_calculation_type: fields.extra_guest_fee_calculation_type ?? 'per_guest',
      extra_guest_fee_booking_type: fields.extra_guest_fee_booking_type ?? 'both',
      cancellation_window_hours: Number(fields.cancellation_window_hours ?? 72),
      cancellation_policy: fields.cancellation_policy ?? null,
      use_property_cancellation_policy: fields.use_property_cancellation_policy ?? true,
      iframe_booking_url: fields.iframe_booking_url || null,
      airbnb_listing_id: fields.airbnb_listing_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const fees: { label: string; amount: number; calculation_type: 'fixed' | 'per_guest' | 'percent'; booking_type: 'short_term' | 'long_term' | 'both' }[] = fields.fees ?? []
  const validBookingTypes = new Set(['short_term', 'long_term', 'both'])
  const validCalcTypes = new Set(['fixed', 'per_guest', 'percent'])
  if (fees.some((f) => !validBookingTypes.has(f.booking_type))) {
    return NextResponse.json({ error: 'Invalid booking_type — must be short_term, long_term, or both' }, { status: 400 })
  }
  if (fees.some((f) => !validCalcTypes.has(f.calculation_type))) {
    return NextResponse.json({ error: 'Invalid calculation_type — must be fixed, per_guest, or percent' }, { status: 400 })
  }

  // Snapshot existing fees before delete so we can roll back if insert fails
  const { data: existingFees } = await supabase.from('room_fees').select('*').eq('room_id', id)

  const { error: deleteError } = await supabase.from('room_fees').delete().eq('room_id', id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (fees.length > 0) {
    const { error: feesError } = await supabase
      .from('room_fees')
      .insert(fees.map((f) => ({ room_id: id, label: f.label, amount: f.amount, calculation_type: f.calculation_type, booking_type: f.booking_type })))
    if (feesError) {
      // Restore original fees to avoid data loss
      if (existingFees?.length) {
        await supabase.from('room_fees').insert(
          existingFees.map((f) => ({ room_id: id, label: f.label, amount: f.amount, calculation_type: f.calculation_type ?? 'fixed', booking_type: f.booking_type })),
        )
      }
      return NextResponse.json({ error: feesError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
