import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { verifyReviewToken } from '@/lib/review-token'

export async function POST(
  request: NextRequest,
  { params }: { params: { bookingId: string } },
) {
  const { bookingId } = params
  const body = await request.json()
  const { rating, comment, token } = body

  if (!token || !verifyReviewToken(bookingId, token)) {
    return NextResponse.json({ error: 'Invalid review link' }, { status: 403 })
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, check_out')
    .eq('id', bookingId)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const today = new Date().toISOString().split('T')[0]
  if (booking.check_out > today) {
    return NextResponse.json({ error: 'Review not available yet' }, { status: 403 })
  }

  const { error } = await supabase.from('reviews').insert({
    booking_id: bookingId,
    rating,
    comment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
  })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Review already submitted' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
