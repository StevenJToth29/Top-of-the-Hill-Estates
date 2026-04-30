import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'

type BookingRow = {
  id: string
  booking_type: string
  total_amount: number
  processing_fee: number | null
  status: string
  stripe_payment_intent_id: string | null
  room: {
    property: {
      platform_fee_percent: number
      stripe_account: { stripe_account_id: string } | null
    } | null
  } | null
}

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
      .select(`
        id, booking_type, total_amount, processing_fee, status, stripe_payment_intent_id,
        room:rooms(property:properties(platform_fee_percent, stripe_account:stripe_accounts(stripe_account_id)))
      `)
      .eq('id', params.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const typedBooking = booking as unknown as BookingRow

    if (!['pending', 'pending_payment', 'pending_docs'].includes(typedBooking.status)) {
      return NextResponse.json({ error: 'Booking is not in pending status' }, { status: 400 })
    }

    if (!typedBooking.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'Booking payment session not found' }, { status: 409 })
    }

    const [{ data: methodConfig, error: configError }, { data: allMethodConfigs }] = await Promise.all([
      supabase
        .from('payment_method_configs')
        .select('fee_percent, fee_flat, is_enabled')
        .eq('booking_type', typedBooking.booking_type)
        .eq('method_key', method_key)
        .single(),
      supabase
        .from('payment_method_configs')
        .select('method_key')
        .eq('booking_type', typedBooking.booking_type)
        .eq('is_enabled', true)
        .order('sort_order'),
    ])

    if (configError || !methodConfig) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 400 })
    }

    if (!methodConfig.is_enabled) {
      return NextResponse.json({ error: 'Payment method not available' }, { status: 400 })
    }

    const allMethodKeys = (allMethodConfigs ?? []).map((m: { method_key: string }) => m.method_key)

    // Derive base amount so repeated PATCH calls (method changes) stay correct.
    // Round to 2 decimal places to avoid floating-point drift (e.g. 514.80 - 14.80).
    const base_amount = Math.round((Number(typedBooking.total_amount) - Number(typedBooking.processing_fee ?? 0)) * 100) / 100
    const rate = Number(methodConfig.fee_percent) / 100
    const flat = Number(methodConfig.fee_flat)

    // Gross-up: solve for the total such that the collected fee exactly covers
    // what Stripe charges on the total (not just the base).
    // total = (base + flat) / (1 − rate)  →  Stripe's cut = total × rate + flat = total − base
    const grand_total_cents = (rate > 0 || flat > 0)
      ? Math.round((base_amount + flat) / (1 - rate) * 100)
      : Math.round(base_amount * 100)
    const base_cents = Math.round(base_amount * 100)
    const processing_fee_cents = grand_total_cents - base_cents
    const grand_total = grand_total_cents / 100
    const processing_fee = processing_fee_cents / 100

    // application_fee_amount = (base × platform_fee_percent) + full processing_fee
    // This keeps the entire customer-facing processing fee on the platform account,
    // so the connected account always receives exactly base × (1 - platform_fee_percent).
    const connectedAccountId = typedBooking.room?.property?.stripe_account?.stripe_account_id
    const platformFeePercent = Number(typedBooking.room?.property?.platform_fee_percent ?? 0)
    const newAppFeeCents = connectedAccountId
      ? Math.round(base_amount * 100 * (platformFeePercent / 100)) + Math.round(processing_fee * 100)
      : null

    // DB first: if this fails, Stripe is untouched and the call is safely retryable.
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ processing_fee, total_amount: grand_total })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    try {
      await stripe.paymentIntents.update(typedBooking.stripe_payment_intent_id, {
        amount: Math.round(grand_total * 100),
        ...(newAppFeeCents !== null && { application_fee_amount: newAppFeeCents }),
      })
    } catch (stripeErr) {
      // Roll back the DB update so the booking stays consistent with Stripe.
      await supabase
        .from('bookings')
        .update({ processing_fee: typedBooking.processing_fee, total_amount: typedBooking.total_amount })
        .eq('id', params.id)

      // The original PI is in a non-updatable state (canceled, captured, etc.).
      // Create a replacement PI so the user can complete payment without starting over.
      if ((stripeErr as { code?: string }).code === 'payment_intent_unexpected_state') {
        try {
          const freshPI = await stripe.paymentIntents.create({
            amount: grand_total_cents,
            currency: 'usd',
            payment_method_types: allMethodKeys,
            payment_method_options: {
              card: { capture_method: 'manual' },
              cashapp: { capture_method: 'manual' },
              us_bank_account: { verification_method: 'instant' },
            },
            metadata: { booking_id: params.id },
            ...(connectedAccountId && newAppFeeCents !== null && {
              transfer_data: { destination: connectedAccountId },
              application_fee_amount: newAppFeeCents,
            }),
          })
          if (!freshPI.client_secret) throw new Error('No client_secret on fresh PI')
          await supabase
            .from('bookings')
            .update({ stripe_payment_intent_id: freshPI.id, processing_fee, total_amount: grand_total })
            .eq('id', params.id)
          return NextResponse.json({ processing_fee, grand_total, newClientSecret: freshPI.client_secret })
        } catch (freshErr) {
          console.error('payment-method: failed to create replacement PI:', freshErr)
          return NextResponse.json(
            { error: 'This booking session has expired. Please start a new booking.' },
            { status: 409 },
          )
        }
      }

      throw stripeErr
    }

    return NextResponse.json({ processing_fee, grand_total })
  } catch (err) {
    console.error('payment-method PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
