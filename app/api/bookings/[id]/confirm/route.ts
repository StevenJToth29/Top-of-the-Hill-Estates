import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { isRoomAvailableExcluding } from '@/lib/availability'
import { evaluateAndQueueEmails } from '@/lib/email-queue'
import type { Booking } from '@/types'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createServiceRoleClient()

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status, stripe_payment_intent_id, room_id, check_in, check_out')
      .eq('id', params.id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status === 'pending_docs' || booking.status === 'confirmed') {
      return NextResponse.json({ status: 'pending_docs' })
    }

    if (booking.status !== 'pending' && booking.status !== 'pending_payment') {
      return NextResponse.json({ error: 'Booking cannot be confirmed' }, { status: 400 })
    }

    if (!booking.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'No payment intent on booking' }, { status: 400 })
    }

    // Verify with Stripe directly — never trust the client to claim payment succeeded
    const paymentIntent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)

    // requires_capture = card authorized with manual capture (standard flow for approval-based bookings)
    // succeeded        = payment already captured (legacy / direct charge)
    // processing       = ACH/bank transfer initiated, will settle within days
    // requires_action  = micro-deposit verification pending before bank payment clears
    const validStatuses = ['requires_capture', 'succeeded', 'processing', 'requires_action']
    if (!validStatuses.includes(paymentIntent.status)) {
      return NextResponse.json(
        { error: 'Payment not yet authorized' },
        { status: 400 },
      )
    }

    // Re-check availability before locking the dates — another booking may have been confirmed
    // while this one was in pending_payment state (name entered, payment not yet submitted).
    const available = await isRoomAvailableExcluding(
      booking.room_id,
      booking.check_in,
      booking.check_out,
      booking.id,
    )
    if (!available) {
      // Dates are no longer free — void the payment so the customer isn't charged.
      try {
        if (['requires_capture', 'requires_payment_method', 'requires_confirmation', 'requires_action'].includes(paymentIntent.status)) {
          await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
        }
      } catch (cancelErr) {
        console.error('Failed to cancel payment intent after availability conflict:', cancelErr)
      }
      await supabase.from('bookings').update({ status: 'cancelled', cancellation_reason: 'dates_unavailable' }).eq('id', params.id)
      return NextResponse.json({ error: 'These dates are no longer available. Your payment has been voided.' }, { status: 409 })
    }

    const { data: confirmed, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'pending_docs',
        amount_paid: (paymentIntent.amount_received ?? paymentIntent.amount) / 100,
      })
      .eq('id', params.id)
      .in('status', ['pending', 'pending_payment'])
      .select()
      .single()

    if (updateError || !confirmed) {
      console.error('Failed to move booking to pending_docs:', updateError)
      return NextResponse.json({ error: 'Failed to confirm booking' }, { status: 500 })
    }

    evaluateAndQueueEmails('application_needed', {
      type: 'booking',
      bookingId: (confirmed as Booking).id,
    }).catch((err) => { console.error('email queue error:', err) })

    return NextResponse.json({ status: 'pending_docs' })
  } catch (err) {
    console.error('POST /api/bookings/[id]/confirm error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
