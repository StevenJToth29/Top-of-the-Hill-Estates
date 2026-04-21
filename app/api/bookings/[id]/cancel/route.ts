import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { calculateRefund, resolvePolicy } from '@/lib/cancellation'
import { evaluateAndQueueEmails, cancelBookingEmails } from '@/lib/email-queue'
import type { Booking } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const serverClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await serverClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { reason: string; refund_override?: 'full' | 'half' | 'none' }
    const { reason, refund_override } = body
    if (!reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 400 })
    }

    const { data: cancelRoom } = await supabase
      .from('rooms')
      .select('property_id, cancellation_policy, use_property_cancellation_policy')
      .eq('id', (booking as Booking).room_id)
      .single()

    const [{ data: cancelProperty }, { data: cancelSettings }] = await Promise.all([
      cancelRoom?.property_id
        ? supabase
            .from('properties')
            .select('cancellation_policy, use_global_cancellation_policy')
            .eq('id', cancelRoom.property_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('site_settings')
        .select('cancellation_policy')
        .maybeSingle(),
    ])

    const now = new Date()
    const policy = resolvePolicy(cancelRoom ?? {}, cancelProperty ?? {}, cancelSettings)
    const policyRefund = calculateRefund(booking as Booking, now, policy)

    // Admin can override the policy refund amount
    let refundResult = policyRefund
    if (refund_override !== undefined) {
      const amountPaid = (booking as Booking).amount_paid
      const processingFee = (booking as Booking).processing_fee ?? 0
      const refundableBase = amountPaid - processingFee
      const overrideAmount =
        refund_override === 'full' ? Math.round(refundableBase * 100) / 100
        : refund_override === 'half' ? Math.round(refundableBase * 0.5 * 100) / 100
        : 0
      refundResult = {
        ...policyRefund,
        refund_amount: overrideAmount,
        refund_percentage: refund_override === 'full' ? 100 : refund_override === 'half' ? 50 : 0,
      }
    }

    // Update DB first — if the Stripe refund fails we can retry, but we can't
    // un-issue a refund if the DB update fails after the refund is already sent.
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: now.toISOString(),
        refund_amount: refundResult.refund_amount,
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Failed to update booking cancellation:', updateError)
      return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
    }

    if (booking.stripe_payment_intent_id) {
      if (booking.status === 'confirmed' && refundResult.refund_amount > 0) {
        await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent_id,
          amount: Math.round(refundResult.refund_amount * 100),
          reverse_transfer: true,
        })
      } else if (booking.status === 'pending') {
        try {
          await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
        } catch (stripeErr: unknown) {
          const errCode = (stripeErr as { code?: string }).code
          if (errCode === 'payment_intent_unexpected_state') {
            // PI already succeeded (payment came in before booking status updated) — refund in full
            const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
            if (pi.status === 'succeeded' && pi.amount_received > 0) {
              await stripe.refunds.create({
                payment_intent: booking.stripe_payment_intent_id,
                amount: pi.amount_received,
                reverse_transfer: true,
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

    return NextResponse.json({ success: true, refund_amount: refundResult.refund_amount })
  } catch (err) {
    console.error(`POST /api/bookings/${params.id}/cancel error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
