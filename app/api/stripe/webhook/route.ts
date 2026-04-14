import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { createOrUpdateGHLContact, triggerGHLWorkflow } from '@/lib/ghl'
import type { Booking, Room } from '@/types'

async function getRoom(roomId: string): Promise<Room | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('rooms')
    .select('*, property:properties(*)')
    .eq('id', roomId)
    .single()

  if (error) {
    console.error('Failed to fetch room:', error)
    return null
  }
  return data as Room
}

async function syncToGHL(booking: Booking): Promise<void> {
  const room = await getRoom(booking.room_id)
  if (!room) return

  const supabase = createServiceRoleClient()

  const ghlContactId = await createOrUpdateGHLContact({
    firstName: booking.guest_first_name,
    lastName: booking.guest_last_name,
    email: booking.guest_email,
    phone: booking.guest_phone,
    tags: [booking.booking_type, room.property?.name ?? '', room.name],
    customFields: {
      check_in_date: booking.check_in,
      check_out_date: booking.check_out,
      room_slug: room.slug,
      booking_id: booking.id,
    },
  })

  if (ghlContactId) {
    await Promise.all([
      supabase.from('bookings').update({ ghl_contact_id: ghlContactId }).eq('id', booking.id),
      triggerGHLWorkflow(process.env.GHL_BOOKING_WEBHOOK_URL ?? '', {
        bookingId: booking.id,
        contactId: ghlContactId,
        ...booking,
      }),
    ])
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '')
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Webhook signature verification failed', { status: 400 })
  }

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

        await syncToGHL(booking as Booking)
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

        const { data: booking, error } = await supabase
          .from('bookings')
          .update(updatePayload)
          .eq('stripe_payment_intent_id', session.payment_intent as string)
          .select()
          .single()

        if (error || !booking) {
          console.error('Failed to update booking on checkout.session.completed:', error)
          break
        }

        if (isPaid) await syncToGHL(booking as Booking)
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
