import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { timingSafeCompare } from '@/lib/timing-safe-compare'
import { evaluateAndQueueEmails } from '@/lib/email-queue'

const EXPIRY_MINUTES = 30

async function handler(request: NextRequest) {
  if (!timingSafeCompare(request.headers.get('Authorization') ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000).toISOString()

  // Sweep 0: expire pending_payment bookings (name entered, no card submitted) older than 30 min.
  // These never block dates, so expiry is just cleanup — cancel the PI only if it hasn't been touched.
  const { data: stalePendingPayment } = await supabase
    .from('bookings')
    .select('id, stripe_payment_intent_id')
    .eq('status', 'pending_payment')
    .lt('created_at', cutoff)

  const sweep0SuccessIds: string[] = []
  await Promise.all(
    (stalePendingPayment ?? []).map(async (booking) => {
      try {
        if (booking.stripe_payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
          if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(pi.status)) {
            await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
          }
        }
        sweep0SuccessIds.push(booking.id)
      } catch (err) {
        console.error(`expire-pending-payment: failed to expire booking ${booking.id}:`, err)
      }
    }),
  )
  if (sweep0SuccessIds.length > 0) {
    await supabase.from('bookings').update({ status: 'expired' }).in('id', sweep0SuccessIds)
  }

  // Sweep 1: expire pending bookings older than 30 min.
  const { data: stale, error } = await supabase
    .from('bookings')
    .select('id, stripe_payment_intent_id')
    .eq('status', 'pending')
    .lt('created_at', cutoff)

  if (error) {
    console.error('expire-pending-bookings: failed to fetch stale bookings:', error)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }

  const sweep1SuccessIds: string[] = []
  await Promise.all(
    (stale ?? []).map(async (booking) => {
      try {
        if (booking.stripe_payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
          if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(pi.status)) {
            await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
          }
        }
        sweep1SuccessIds.push(booking.id)
      } catch (err) {
        console.error(`expire-pending-bookings: failed to expire booking ${booking.id}:`, err)
      }
    }),
  )
  if (sweep1SuccessIds.length > 0) {
    await supabase.from('bookings').update({ status: 'expired' }).in('id', sweep1SuccessIds)
  }
  for (const id of sweep1SuccessIds) {
    evaluateAndQueueEmails('booking_abandoned', { type: 'booking', bookingId: id }).catch(console.error)
  }

  // Sweep 2: expire pending_docs bookings older than 48 hours
  const docsCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: staleDocs } = await supabase
    .from('bookings')
    .select('id, stripe_payment_intent_id')
    .eq('status', 'pending_docs')
    .lt('created_at', docsCutoff)

  const sweep2SuccessIds: string[] = []
  await Promise.all(
    (staleDocs ?? []).map(async (booking) => {
      try {
        if (booking.stripe_payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
          if (['requires_capture', 'requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(pi.status)) {
            await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
          }
        }
        sweep2SuccessIds.push(booking.id)
      } catch (err) {
        console.error(`expire-pending-docs: failed to expire booking ${booking.id}:`, err)
      }
    }),
  )
  if (sweep2SuccessIds.length > 0) {
    await supabase.from('bookings').update({ status: 'expired' }).in('id', sweep2SuccessIds)
  }
  // evaluateAndQueueEmails is fire-and-forget per booking — keep per-booking
  for (const id of sweep2SuccessIds) {
    evaluateAndQueueEmails('application_expired', { type: 'booking', bookingId: id }).catch(console.error)
  }

  // Sweep 3: auto-decline under_review bookings past their application_deadline
  const { data: overdueReviews } = await supabase
    .from('bookings')
    .select('id, stripe_payment_intent_id')
    .eq('status', 'under_review')
    .lt('application_deadline', new Date().toISOString())

  const sweep3SuccessIds: string[] = []
  await Promise.all(
    (overdueReviews ?? []).map(async (booking) => {
      try {
        if (booking.stripe_payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
          // Note: 'processing' is excluded here — unlike authorize-capture cards (Sweep 2),
          // an under_review booking that reached processing has likely already settled
          // and should not be forcibly cancelled via this path.
          const cancellableStatuses = ['requires_capture', 'requires_payment_method', 'requires_confirmation', 'requires_action']
          if (cancellableStatuses.includes(pi.status)) {
            await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
          }
        }
        sweep3SuccessIds.push(booking.id)
      } catch (err) {
        console.error(`auto-decline-review: failed to decline booking ${booking.id}:`, err)
      }
    }),
  )
  if (sweep3SuccessIds.length > 0) {
    await supabase.from('bookings').update({ status: 'cancelled' }).in('id', sweep3SuccessIds)
    const { error: appErr } = await supabase
      .from('booking_applications')
      .update({ decision: 'declined', decline_reason: 'Automatically declined — review deadline passed' })
      .in('booking_id', sweep3SuccessIds)
    if (appErr) console.error('auto-decline-review: failed to batch-update booking_applications:', appErr)
  }
  // evaluateAndQueueEmails is fire-and-forget per booking — keep per-booking
  for (const id of sweep3SuccessIds) {
    evaluateAndQueueEmails('booking_auto_declined', { type: 'booking', bookingId: id }).catch(console.error)
    evaluateAndQueueEmails('admin_missed_deadline', { type: 'booking', bookingId: id }).catch(console.error)
  }

  return NextResponse.json({
    expired: sweep1SuccessIds.length,
    failed: (stale ?? []).length - sweep1SuccessIds.length,
    docs_expired: sweep2SuccessIds.length,
    reviews_auto_declined: sweep3SuccessIds.length,
  })
}

export const GET = handler
export const POST = handler
