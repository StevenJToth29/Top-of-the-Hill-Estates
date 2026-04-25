import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
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
      .select('id, status, stripe_payment_intent_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status === 'pending_docs' || booking.status === 'confirmed') {
      return NextResponse.json({ status: 'pending_docs' })
    }

    if (booking.status !== 'pending') {
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

    const { data: confirmed, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'pending_docs',
        amount_paid: (paymentIntent.amount_received ?? paymentIntent.amount) / 100,
      })
      .eq('id', params.id)
      .eq('status', 'pending')
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
