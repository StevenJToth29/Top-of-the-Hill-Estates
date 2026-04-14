import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/availability'
import type { BookingType } from '@/types'

interface CreateBookingBody {
  room_id: string
  room_slug: string
  booking_type: BookingType
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_phone: string
  check_in: string
  check_out: string
  guests: number
  nightly_rate: number
  monthly_rate: number
  total_nights: number
  total_amount: number
  amount_to_pay: number
  amount_due_at_checkin: number
  sms_consent: boolean
  marketing_consent: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateBookingBody

    const {
      room_id,
      booking_type,
      guest_first_name,
      guest_last_name,
      guest_email,
      guest_phone,
      check_in,
      check_out,
      total_nights,
      nightly_rate,
      monthly_rate,
      total_amount,
      amount_to_pay,
      amount_due_at_checkin,
      sms_consent,
      marketing_consent,
    } = body

    const available = await isRoomAvailable(room_id, check_in, check_out)
    if (!available) {
      return NextResponse.json({ error: 'Room is not available for the selected dates' }, { status: 409 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount_to_pay * 100),
      currency: 'usd',
      metadata: { room_id, booking_type, guest_email },
    })

    const supabase = createServiceRoleClient()
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        room_id,
        booking_type,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        check_in,
        check_out,
        total_nights,
        nightly_rate,
        monthly_rate,
        total_amount,
        amount_paid: 0,
        amount_due_at_checkin,
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending',
        sms_consent,
        marketing_consent,
      })
      .select()
      .single()

    if (error || !booking) {
      console.error('Failed to create booking record:', error)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    return NextResponse.json({
      bookingId: booking.id,
      clientSecret: paymentIntent.client_secret,
    })
  } catch (err) {
    console.error('POST /api/bookings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const booking_id = searchParams.get('booking_id')

    if (!booking_id) {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, room:rooms(*, property:properties(*))')
      .eq('id', booking_id)
      .single()

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    return NextResponse.json(booking)
  } catch (err) {
    console.error('GET /api/bookings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
