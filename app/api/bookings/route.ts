import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/availability'
import type { BookingType } from '@/types'

interface CreateBookingBody {
  room_id: string
  booking_type: BookingType
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_phone: string
  check_in: string
  check_out: string
  guests: number
  total_nights: number
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
      sms_consent,
      marketing_consent,
    } = body

    const supabase = createServiceRoleClient()

    // Fetch authoritative room rates — never trust client-supplied prices
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('nightly_rate, monthly_rate')
      .eq('id', room_id)
      .eq('is_active', true)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const available = await isRoomAvailable(room_id, check_in, check_out)
    if (!available) {
      return NextResponse.json({ error: 'Room is not available for the selected dates' }, { status: 409 })
    }

    // Compute all amounts server-side from authoritative room data
    const nightly_rate = room.nightly_rate
    const monthly_rate = room.monthly_rate
    let total_amount: number
    let amount_to_pay: number
    let amount_due_at_checkin: number

    if (booking_type === 'short_term') {
      total_amount = total_nights * nightly_rate
      amount_to_pay = total_amount
      amount_due_at_checkin = 0
    } else {
      // Long-term: collect first month's rent as deposit; balance due at check-in
      amount_to_pay = monthly_rate
      amount_due_at_checkin = monthly_rate
      total_amount = amount_to_pay + amount_due_at_checkin
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount_to_pay * 100),
      currency: 'usd',
      metadata: { room_id, booking_type, guest_email },
    })

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
      total_amount,
      amount_due_at_checkin,
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
    const guest_email = searchParams.get('guest_email')

    if (!booking_id || !guest_email) {
      return NextResponse.json({ error: 'booking_id and guest_email are required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, room:rooms(*, property:properties(*))')
      .eq('id', booking_id)
      .ilike('guest_email', guest_email)
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
