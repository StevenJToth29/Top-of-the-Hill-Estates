import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json()
    const { method_key } = body

    if (!method_key) {
      return NextResponse.json({ error: 'method_key is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booking_type, total_amount, processing_fee, status, stripe_payment_intent_id')
      .eq('id', params.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status !== 'pending') {
      return NextResponse.json({ error: 'Booking is not in pending status' }, { status: 400 })
    }

    if (!booking.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'Booking payment session not found' }, { status: 409 })
    }

    const { data: methodConfig, error: configError } = await supabase
      .from('payment_method_configs')
      .select('fee_percent, fee_flat, is_enabled')
      .eq('booking_type', booking.booking_type)
      .eq('method_key', method_key)
      .single()

    if (configError || !methodConfig) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 400 })
    }

    if (!methodConfig.is_enabled) {
      return NextResponse.json({ error: 'Payment method not available' }, { status: 400 })
    }

    // Derive base amount so repeated PATCH calls (method changes) stay correct.
    // Round to 2 decimal places to avoid floating-point drift (e.g. 514.80 - 14.80).
    const base_amount = Math.round((Number(booking.total_amount) - Number(booking.processing_fee ?? 0)) * 100) / 100
    const processing_fee = Math.round(
      (base_amount * (Number(methodConfig.fee_percent) / 100) + Number(methodConfig.fee_flat)) * 100
    ) / 100
    const grand_total = Math.round((base_amount + processing_fee) * 100) / 100

    await stripe.paymentIntents.update(booking.stripe_payment_intent_id, {
      amount: Math.round(grand_total * 100),
    })

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ processing_fee, total_amount: grand_total })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ processing_fee, grand_total })
  } catch (err) {
    console.error('payment-method PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
