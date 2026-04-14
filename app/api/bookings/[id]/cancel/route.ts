import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { calculateRefund } from '@/lib/cancellation'
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

    const { reason } = (await request.json()) as { reason: string }
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

    const now = new Date()
    const refundResult = calculateRefund(booking as Booking, now)

    if (refundResult.refund_amount > 0 && booking.stripe_payment_intent_id) {
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: Math.round(refundResult.refund_amount * 100),
      })
    }

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

    return NextResponse.json({ success: true, refund_amount: refundResult.refund_amount })
  } catch (err) {
    console.error(`POST /api/bookings/${params.id}/cancel error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
