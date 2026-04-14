import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { calculateRefund } from '@/lib/cancellation'
import type { Booking } from '@/types'

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServiceRoleClient()

  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
  }

  if (booking.status !== 'confirmed' && booking.status !== 'pending') {
    return NextResponse.json(
      { error: 'Only confirmed or pending bookings can be cancelled.' },
      { status: 400 },
    )
  }

  let reason: string
  try {
    const body = await request.json()
    reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!reason) {
    return NextResponse.json({ error: 'A cancellation reason is required.' }, { status: 400 })
  }

  const cancelledAt = new Date()
  const refund = calculateRefund(booking as Booking, cancelledAt)

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancellation_reason: reason,
      cancelled_at: cancelledAt.toISOString(),
      refund_amount: refund.refund_amount,
      updated_at: cancelledAt.toISOString(),
    })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to cancel booking.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, refund_amount: refund.refund_amount })
}
