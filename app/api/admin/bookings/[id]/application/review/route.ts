import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { capturePaymentIntent, stripe } from '@/lib/stripe'
import { evaluateAndQueueEmails, seedReminderEmails, cancelBookingEmails } from '@/lib/email-queue'
import { generateTasksForBooking } from '@/lib/task-automation'

interface RouteContext { params: Promise<{ id: string }> }
interface ReviewBody { decision: 'approved' | 'declined'; decline_reason?: string }

export async function PATCH(req: Request, { params }: RouteContext) {
  const [{ id: bookingId }, body] = await Promise.all([params, req.json() as Promise<ReviewBody>])

  if (body.decision !== 'approved' && body.decision !== 'declined') {
    return NextResponse.json({ error: 'decision must be "approved" or "declined"' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Run auth check and booking fetch in parallel
  const [{ data: { user } }, { data: booking }] = await Promise.all([
    createServerSupabaseClient().then(c => c.auth.getUser()),
    supabase
      .from('bookings')
      .select('id, status, stripe_payment_intent_id, total_amount')
      .eq('id', bookingId)
      .maybeSingle(),
  ])

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Update booking and application in parallel now that payment is captured
    await Promise.all([
      supabase
        .from('bookings')
        .update({ status: 'confirmed', amount_paid: booking.total_amount, updated_at: now })
        .eq('id', bookingId),
      supabase
        .from('booking_applications')
        .update({ decision: 'approved', reviewed_at: now, reviewed_by: user.id })
        .eq('booking_id', bookingId),
    ])

    evaluateAndQueueEmails('booking_approved', { type: 'booking', bookingId }).catch(
      (err) => { console.error('email queue error on booking_approved:', err) }
    )
    evaluateAndQueueEmails('admin_new_booking', { type: 'booking', bookingId }).catch(
      (err) => { console.error('email queue error on admin_new_booking:', err) }
    )
    seedReminderEmails(booking.id).catch(
      (err) => { console.error('seedReminderEmails error:', err) }
    )
    generateTasksForBooking(bookingId, 'booking_confirmed').catch(
      (err) => { console.error('task automation error on booking_approved:', err) }
    )
  } else {
    // For decline: attempt PI cancel and DB updates in parallel.
    // capturePaymentIntent_unexpected_state means the PI is already in processing/succeeded
    // (e.g. ACH already settled) — we log it but still cancel the booking in the DB.
    const stripeCancel = booking.stripe_payment_intent_id
      ? stripe.paymentIntents.cancel(booking.stripe_payment_intent_id).catch((err: unknown) => {
          const code = (err as { code?: string }).code
          if (code === 'payment_intent_unexpected_state') {
            // PI is in processing or already succeeded — cannot cancel, log for manual review
            console.warn('review: PI not cancellable (likely ACH in processing):', booking.stripe_payment_intent_id)
          } else {
            console.error('review: failed to cancel payment intent:', err)
          }
        })
      : Promise.resolve()

    await Promise.all([
      stripeCancel,
      supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: now })
        .eq('id', bookingId),
      supabase
        .from('booking_applications')
        .update({
          decision: 'declined',
          decline_reason: body.decline_reason ?? null,
          reviewed_at: now,
          reviewed_by: user.id,
        })
        .eq('booking_id', bookingId),
    ])

    // Fire-and-forget — no need to block the response on email queue updates
    cancelBookingEmails(bookingId).catch((err) => console.error('cancelBookingEmails error:', err))
    evaluateAndQueueEmails('booking_declined', { type: 'booking', bookingId }).catch(
      (err) => { console.error('email queue error on booking_declined:', err) }
    )
  }

  return NextResponse.json({ success: true, decision: body.decision })
}
