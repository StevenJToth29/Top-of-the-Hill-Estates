import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { calculateRefund, resolvePolicy } from '@/lib/cancellation'
import { evaluateAndQueueEmails, cancelBookingEmails } from '@/lib/email-queue'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import type { Booking } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!checkRateLimit(getClientIp(request), 'guest-cancel', 3)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  try {
    const body = (await request.json()) as { guest_email?: string }
    const { guest_email } = body

    if (!guest_email) {
      return NextResponse.json({ error: 'guest_email is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.guest_email.toLowerCase() !== guest_email.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      return NextResponse.json(
        { error: 'Booking cannot be cancelled in its current state' },
        { status: 400 },
      )
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('property_id, cancellation_policy, use_property_cancellation_policy')
      .eq('id', booking.room_id)
      .single()

    const [{ data: property }, { data: siteSettings }] = await Promise.all([
      room?.property_id
        ? supabase
            .from('properties')
            .select('cancellation_policy, use_global_cancellation_policy')
            .eq('id', room.property_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('site_settings')
        .select('cancellation_policy')
        .maybeSingle(),
    ])

    const policy = resolvePolicy(room ?? {}, property ?? {}, siteSettings)
    const now = new Date()
    const refund = calculateRefund(booking as Booking, now, policy)

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: 'guest_requested',
        cancelled_at: now.toISOString(),
        refund_amount: refund.refund_amount,
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Failed to cancel booking:', updateError)
      return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
    }

    if (booking.stripe_payment_intent_id) {
      if (booking.status === 'confirmed' && refund.refund_amount > 0) {
        await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent_id,
          amount: Math.round(refund.refund_amount * 100),
        })
      } else if (booking.status === 'pending') {
        try {
          await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
        } catch (stripeErr: unknown) {
          const errCode = (stripeErr as { code?: string }).code
          if (errCode === 'payment_intent_unexpected_state') {
            const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
            if (pi.status === 'succeeded' && pi.amount_received > 0) {
              await stripe.refunds.create({
                payment_intent: booking.stripe_payment_intent_id,
                amount: pi.amount_received,
              })
            }
          } else {
            console.warn('Stripe PaymentIntent cancel skipped:', (stripeErr as Error).message)
          }
        }
      }
    }

    evaluateAndQueueEmails('booking_cancelled', {
      type: 'booking',
      bookingId: params.id,
    }).catch((err) => { console.error('email queue error on booking_cancelled:', err) })

    evaluateAndQueueEmails('admin_cancelled', {
      type: 'booking',
      bookingId: params.id,
    }).catch((err) => { console.error('email queue error on admin_cancelled:', err) })

    cancelBookingEmails(params.id).catch((err) => {
      console.error('cancelBookingEmails error:', err)
    })

    return NextResponse.json({ success: true, refund_amount: refund.refund_amount })
  } catch (err) {
    console.error(`POST /api/bookings/${params.id}/cancel/guest error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
