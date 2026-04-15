import { NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/availability'
import { OPEN_ENDED_DATE } from '@/lib/format'
import type { BookingType } from '@/types'

export async function POST(request: Request) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const required = [
    'room_id',
    'booking_type',
    'guest_first_name',
    'guest_last_name',
    'guest_email',
    'guest_phone',
    'check_in',
  ] as const

  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  // Compute amounts server-side
  const bookingType = body.booking_type as BookingType

  // check_out is required for short-term; for long-term it defaults to open-ended
  const checkOut = body.check_out
    ? (body.check_out as string)
    : bookingType === 'long_term'
      ? OPEN_ENDED_DATE
      : null

  if (!checkOut) {
    return NextResponse.json({ error: 'Missing required field: check_out' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Fetch authoritative room rates — never trust client-supplied prices
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('nightly_rate, monthly_rate')
    .eq('id', body.room_id as string)
    .eq('is_active', true)
    .single()

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  // Check availability before creating booking (skip for open-ended long-term)
  if (checkOut !== OPEN_ENDED_DATE) {
    const available = await isRoomAvailable(
      body.room_id as string,
      body.check_in as string,
      checkOut,
    )
    if (!available) {
      return NextResponse.json({ error: 'Room is not available for the selected dates' }, { status: 409 })
    }
  }

  const totalNights = checkOut === OPEN_ENDED_DATE ? 0 : Number(body.total_nights ?? 1)
  let total_amount: number
  let amount_due_at_checkin: number

  if (bookingType === 'short_term') {
    total_amount = totalNights * room.nightly_rate
    amount_due_at_checkin = 0
  } else {
    total_amount = room.monthly_rate * 2
    amount_due_at_checkin = room.monthly_rate
  }

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      room_id: body.room_id,
      booking_type: bookingType,
      guest_first_name: body.guest_first_name,
      guest_last_name: body.guest_last_name,
      guest_email: body.guest_email,
      guest_phone: body.guest_phone,
      sms_consent: body.sms_consent ?? false,
      marketing_consent: body.marketing_consent ?? false,
      check_in: body.check_in,
      check_out: checkOut,
      total_nights: totalNights,
      nightly_rate: room.nightly_rate,
      monthly_rate: room.monthly_rate,
      total_amount,
      amount_paid: 0,
      amount_due_at_checkin,
      stripe_payment_intent_id: null,
      stripe_session_id: null,
      status: 'confirmed',
      ghl_contact_id: null,
      cancellation_reason: null,
      cancelled_at: null,
      refund_amount: null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, booking: data }, { status: 201 })
}
