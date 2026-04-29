import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { notifyGHLBookingConfirmed } from '@/lib/ghl'
import { evaluateAndQueueEmails, seedReminderEmails } from '@/lib/email-queue'
import { generateTasksForBooking } from '@/lib/task-automation'
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
        console.log('payment_intent.succeeded for PI:', paymentIntent.id, 'amount_received:', paymentIntent.amount_received)

        const { data: booking, error } = await supabase
          .from('bookings')
          .update({
            status: 'confirmed',
            amount_paid: (paymentIntent.amount_received ?? paymentIntent.amount) / 100,
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .eq('status', 'pending')
          .select()
          .single()

        if (error || !booking) {
          console.error('Failed to confirm booking on payment_intent.succeeded:', error)
          return new Response('DB update failed', { status: 500 })
        }

        notifyGHLBookingConfirmed(booking as Booking).catch((err) => {
          console.error('GHL confirmation trigger error:', err)
        })

        evaluateAndQueueEmails('booking_confirmed', {
          type: 'booking',
          bookingId: (booking as Booking).id,
        }).catch((err) => { console.error('email queue error on booking_confirmed:', err) })

        evaluateAndQueueEmails('admin_new_booking', {
          type: 'booking',
          bookingId: (booking as Booking).id,
        }).catch((err) => { console.error('email queue error on admin_new_booking:', err) })

        seedReminderEmails((booking as Booking).id).catch((err) => {
          console.error('seedReminderEmails error:', err)
        })
        generateTasksForBooking((booking as Booking).id, 'booking_confirmed').catch((err) => {
          console.error('task automation error on booking_confirmed:', err)
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
          .eq('status', 'pending')

        if (error) {
          console.error('Failed to cancel booking on payment_intent.payment_failed:', error)
          return new Response('DB update failed', { status: 500 })
        }
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const isPaid = session.payment_status === 'paid'

        // Additional-charge checkout from the booking-edit flow — look up by booking_id in metadata
        if (session.metadata?.type === 'booking_edit_additional_charge') {
          const bookingId = session.metadata.booking_id
          if (bookingId && isPaid && session.amount_total) {
            const { data: existingBooking } = await supabase
              .from('bookings')
              .select('amount_paid')
              .eq('id', bookingId)
              .single()

            if (existingBooking) {
              const additionalPaid = session.amount_total / 100
              const { error } = await supabase
                .from('bookings')
                .update({
                  amount_paid: existingBooking.amount_paid + additionalPaid,
                  amount_due_at_checkin: 0,
                })
                .eq('id', bookingId)

              if (error) {
                console.error('Failed to update amount_paid on additional-charge checkout:', error)
              }
            }
          }
          break
        }

        // Standard checkout session (original booking payment)
        if (!session.payment_intent) break

        const updatePayload: Record<string, unknown> = { stripe_session_id: session.id }
        if (isPaid) {
          updatePayload.status = 'confirmed'
          if (session.amount_total) {
            updatePayload.amount_paid = session.amount_total / 100
          }
        }

        const query = supabase
          .from('bookings')
          .update(updatePayload)
          .eq('stripe_payment_intent_id', session.payment_intent as string)
        const { data: updatedBookings, error } = isPaid
          ? await query.eq('status', 'pending').select('id')
          : await query.select('id')

        if (error) {
          console.error('Failed to update booking on checkout.session.completed:', error)
        } else if (isPaid && updatedBookings && updatedBookings.length > 0) {
          // Fire task generation for each booking confirmed through this path (idempotent)
          for (const b of updatedBookings) {
            generateTasksForBooking(b.id, 'booking_confirmed').catch((err) => {
              console.error('task automation error on checkout.session.completed:', err)
            })
          }
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
