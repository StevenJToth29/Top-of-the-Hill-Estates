import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function POST(request: Request) {
  const supabase = createServiceRoleClient()

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
    'check_out',
  ] as const

  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      room_id: body.room_id,
      booking_type: body.booking_type,
      guest_first_name: body.guest_first_name,
      guest_last_name: body.guest_last_name,
      guest_email: body.guest_email,
      guest_phone: body.guest_phone,
      sms_consent: body.sms_consent ?? false,
      marketing_consent: body.marketing_consent ?? false,
      check_in: body.check_in,
      check_out: body.check_out,
      total_nights: body.total_nights ?? 0,
      nightly_rate: body.nightly_rate ?? 0,
      monthly_rate: body.monthly_rate ?? 0,
      total_amount: body.total_amount ?? 0,
      amount_paid: 0,
      amount_due_at_checkin: body.amount_due_at_checkin ?? 0,
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
