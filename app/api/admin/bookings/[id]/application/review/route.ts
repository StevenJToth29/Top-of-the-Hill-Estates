import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { capturePaymentIntent, stripe } from '@/lib/stripe'
import { evaluateAndQueueEmails, seedReminderEmails, cancelBookingEmails } from '@/lib/email-queue'

interface RouteContext { params: Promise<{ id: string }> }
interface ReviewBody { decision: 'approved' | 'declined'; decline_reason?: string }

export async function PATCH(req: Request, { params }: RouteContext) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: bookingId } = await params
  const body = (await req.json()) as ReviewBody

  if (body.decision !== 'approved' && body.decision !== 'declined') {
    return NextResponse.json({ error: 'decision must be "approved" or "declined"' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, room:rooms(*, property:properties(*))')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status !== 'under_review') {
    return NextResponse.json({ error: 'Booking is not under review' }, { status: 409 })
  }

  const now = new Date().toISOString()

  if (body.decision === 'approved') {
    if (!booking.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'No payment intent found for this booking' }, { status: 400 })
    }

    try {
      await capturePaymentIntent(booking.stripe_payment_intent_id)
    } catch (err) {
      console.error('review: failed to capture payment:', err)
      return NextResponse.json({ error: 'Payment capture failed' }, { status: 502 })
    }

    await supabase
      .from('bookings')
      .update({ status: 'confirmed', amount_paid: booking.total_amount, updated_at: now })
      .eq('id', bookingId)

    await supabase
      .from('booking_applications')
      .update({ decision: 'approved', reviewed_at: now, reviewed_by: user.id })
      .eq('booking_id', bookingId)

    evaluateAndQueueEmails('booking_approved', { type: 'booking', bookingId }).catch(
      (err) => { console.error('email queue error on booking_approved:', err) }
    )
    evaluateAndQueueEmails('admin_new_booking', { type: 'booking', bookingId }).catch(
      (err) => { console.error('email queue error on admin_new_booking:', err) }
    )
    seedReminderEmails(booking.id).catch(
      (err) => { console.error('seedReminderEmails error:', err) }
    )
  } else {
    try {
      if (booking.stripe_payment_intent_id) {
        const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
        if (['requires_capture', 'requires_payment_method', 'requires_confirmation', 'requires_action'].includes(pi.status)) {
          await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
        }
      }
    } catch (err) {
      console.error('review: failed to cancel payment intent:', err)
    }

    await supabase
      .from('bookings')
      .update({ status: 'cancelled', updated_at: now })
      .eq('id', bookingId)

    await supabase
      .from('booking_applications')
      .update({
        decision: 'declined',
        decline_reason: body.decline_reason ?? null,
        reviewed_at: now,
        reviewed_by: user.id,
      })
      .eq('booking_id', bookingId)

    await cancelBookingEmails(bookingId).catch((err) => console.error('cancelBookingEmails error:', err))

    evaluateAndQueueEmails('booking_declined', { type: 'booking', bookingId }).catch(
      (err) => { console.error('email queue error on booking_declined:', err) }
    )
  }

  return NextResponse.json({ success: true, decision: body.decision })
}
