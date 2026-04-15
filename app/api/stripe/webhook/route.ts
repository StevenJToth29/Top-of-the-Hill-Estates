import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { notifyGHLBookingConfirmed } from '@/lib/ghl'
import type { Booking } from '@/types'

export async function POST(request: NextRequest) {
  console.log('Stripe webhook received')
  const body = await request.text()
  const sig = request.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '')
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Webhook signature verification failed', { status: 400 })
  }
  console.log('Stripe event type:', event.type)

  const supabase = createServiceRoleClient()

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        const { data: booking, error } = await supabase
          .from('bookings')
          .update({
            status: 'confirmed',
            amount_paid: paymentIntent.amount_received / 100,
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .select()
          .single()

        if (error || !booking) {
          console.error('Failed to confirm booking on payment_intent.succeeded:', error)
          break
        }

        notifyGHLBookingConfirmed(booking as Booking).catch((err) => {
          console.error('GHL confirmation trigger error:', err)
        })
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        const { error } = await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            cancellation_reason: 'payment_failed',
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        if (error) {
          console.error('Failed to cancel booking on payment_intent.payment_failed:', error)
        }
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const isPaid = session.payment_status === 'paid'

        const updatePayload: Record<string, unknown> = { stripe_session_id: session.id }
        if (isPaid) {
          updatePayload.status = 'confirmed'
          if (session.amount_total) {
            updatePayload.amount_paid = session.amount_total / 100
          }
        }

        const { error } = await supabase
          .from('bookings')
          .update(updatePayload)
          .eq('stripe_payment_intent_id', session.payment_intent as string)

        if (error) {
          console.error('Failed to update booking on checkout.session.completed:', error)
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return new Response('Internal server error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}
