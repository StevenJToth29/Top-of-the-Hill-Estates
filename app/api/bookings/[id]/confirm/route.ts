import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { notifyGHLBookingConfirmed } from '@/lib/ghl'
import { evaluateAndQueueEmails, seedReminderEmails } from '@/lib/email-queue'
import type { Booking } from '@/types'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createServiceRoleClient()

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status, stripe_payment_intent_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status === 'confirmed') {
      return NextResponse.json({ status: 'confirmed' })
    }

    if (booking.status !== 'pending') {
      return NextResponse.json({ error: 'Booking cannot be confirmed' }, { status: 400 })
    }

    if (!booking.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'No payment intent on booking' }, { status: 400 })
    }

    // Verify with Stripe directly — never trust the client to claim payment succeeded
    const paymentIntent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)

    // ACH/bank account payments are async: they move through processing → succeeded over 1-5 days.
    // requires_action = micro-deposit verification pending (user must verify before payment clears)
    // processing     = bank transfer initiated, will succeed/fail within days
    // Both are valid post-authorization states — let the booking proceed and the webhook confirms it.
    if (paymentIntent.status === 'processing') {
      return NextResponse.json({ status: 'processing' })
    }

    if (paymentIntent.status === 'requires_action') {
      return NextResponse.json({ status: 'requires_action' })
    }

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment not complete (status: ${paymentIntent.status})` },
        { status: 402 },
      )
    }

    const { data: confirmed, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        amount_paid: (paymentIntent.amount_received ?? paymentIntent.amount) / 100,
      })
      .eq('id', params.id)
      .eq('status', 'pending')
      .select()
      .single()

    if (updateError || !confirmed) {
      console.error('Failed to confirm booking:', updateError)
      return NextResponse.json({ error: 'Failed to confirm booking' }, { status: 500 })
    }

    notifyGHLBookingConfirmed(confirmed as Booking).catch((err) => {
      console.error('GHL confirmation trigger error:', err)
    })

    evaluateAndQueueEmails('booking_confirmed', {
      type: 'booking',
      bookingId: (confirmed as Booking).id,
    }).catch((err) => { console.error('email queue error on booking_confirmed:', err) })

    evaluateAndQueueEmails('admin_new_booking', {
      type: 'booking',
      bookingId: (confirmed as Booking).id,
    }).catch((err) => { console.error('email queue error on admin_new_booking:', err) })

    seedReminderEmails((confirmed as Booking).id).catch((err) => {
      console.error('seedReminderEmails error:', err)
    })

    return NextResponse.json({ status: 'confirmed' })
  } catch (err) {
    console.error('POST /api/bookings/[id]/confirm error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
