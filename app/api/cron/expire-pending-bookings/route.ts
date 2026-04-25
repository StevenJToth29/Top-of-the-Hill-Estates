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

  const { data: stale, error } = await supabase
    .from('bookings')
    .select('id, stripe_payment_intent_id')
    .eq('status', 'pending')
    .lt('created_at', cutoff)

  if (error) {
    console.error('expire-pending-bookings: failed to fetch stale bookings:', error)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }

  const results = await Promise.all(
    (stale ?? []).map(async (booking) => {
      try {
        if (booking.stripe_payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
          if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(pi.status)) {
            await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
          }
        }
        await supabase.from('bookings').update({ status: 'expired' }).eq('id', booking.id)
        return true
      } catch (err) {
        console.error(`expire-pending-bookings: failed to expire booking ${booking.id}:`, err)
        return false
      }
    }),
  )

  // Sweep 2: expire pending_docs bookings older than 48 hours
  const docsCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: staleDocs } = await supabase
    .from('bookings')
    .select('id, stripe_payment_intent_id')
    .eq('status', 'pending_docs')
    .lt('created_at', docsCutoff)

  const docsResults = await Promise.all(
    (staleDocs ?? []).map(async (booking) => {
      try {
        if (booking.stripe_payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
          if (['requires_capture', 'requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(pi.status)) {
            await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
          }
        }
        await supabase.from('bookings').update({ status: 'expired' }).eq('id', booking.id)
        evaluateAndQueueEmails('application_expired', { type: 'booking', bookingId: booking.id }).catch(console.error)
        return true
      } catch (err) {
        console.error(`expire-pending-docs: failed to expire booking ${booking.id}:`, err)
        return false
      }
    }),
  )

  // Sweep 3: auto-decline under_review bookings past their application_deadline
  const { data: overdueReviews } = await supabase
    .from('bookings')
    .select('id, stripe_payment_intent_id')
    .eq('status', 'under_review')
    .lt('application_deadline', new Date().toISOString())

  const reviewResults = await Promise.all(
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
        await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
        const { error: appErr } = await supabase
          .from('booking_applications')
          .update({ decision: 'declined', decline_reason: 'Automatically declined — review deadline passed' })
          .eq('booking_id', booking.id)
        if (appErr) console.error(`auto-decline-review: failed to update application for booking ${booking.id}:`, appErr)
        evaluateAndQueueEmails('booking_auto_declined', { type: 'booking', bookingId: booking.id }).catch(console.error)
        evaluateAndQueueEmails('admin_missed_deadline', { type: 'booking', bookingId: booking.id }).catch(console.error)
        return true
      } catch (err) {
        console.error(`auto-decline-review: failed to decline booking ${booking.id}:`, err)
        return false
      }
    }),
  )

  return NextResponse.json({
    expired: results.filter(Boolean).length,
    failed: results.filter((r) => !r).length,
    docs_expired: docsResults.filter(Boolean).length,
    reviews_auto_declined: reviewResults.filter(Boolean).length,
  })
}

export const GET = handler
export const POST = handler
