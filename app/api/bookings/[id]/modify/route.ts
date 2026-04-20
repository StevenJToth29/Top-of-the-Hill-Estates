import { NextRequest, NextResponse } from 'next/server'
import { evaluateAndQueueEmails } from '@/lib/email-queue'
import { createServiceRoleClient } from '@/lib/supabase'
import { isWithinCancellationWindow } from '@/lib/cancellation'
import { isRoomAvailableExcluding } from '@/lib/availability'
import { differenceInCalendarDays, parseISO } from 'date-fns'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await request.json()) as {
      guest_email?: string
      check_in?: string
      check_out?: string
      guest_count?: number
    }

    const { guest_email, check_in, check_out, guest_count } = body

    if (!guest_email || !check_in || !check_out || guest_count == null) {
      return NextResponse.json({ error: 'guest_email, check_in, check_out, and guest_count are required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, room:rooms(nightly_rate, monthly_rate, cleaning_fee, security_deposit, extra_guest_fee, guest_capacity, minimum_nights_short_term, minimum_nights_long_term, cancellation_window_hours)')
      .eq('id', params.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.guest_email.toLowerCase() !== guest_email.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Booking cannot be modified in its current state' }, { status: 400 })
    }

    const windowHours: number = booking.room?.cancellation_window_hours ?? 72
    const now = new Date()

    if (isWithinCancellationWindow(booking, now, windowHours)) {
      return NextResponse.json(
        { error: `Modifications are not available within ${windowHours} hours of check-in` },
        { status: 400 },
      )
    }

    // Check for existing pending modification request
    const { data: existingRequest } = await supabase
      .from('booking_modification_requests')
      .select('id')
      .eq('booking_id', params.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingRequest) {
      return NextResponse.json({ error: 'A pending modification request already exists for this booking' }, { status: 409 })
    }

    // Validate dates
    const checkInDate = parseISO(check_in)
    const checkOutDate = parseISO(check_out)
    const totalNights = differenceInCalendarDays(checkOutDate, checkInDate)

    if (totalNights <= 0) {
      return NextResponse.json({ error: 'check_out must be after check-in' }, { status: 400 })
    }

    // Check availability (excluding this booking's own dates)
    const available = await isRoomAvailableExcluding(booking.room_id, check_in, check_out, params.id)
    if (!available) {
      return NextResponse.json({ error: 'Room is not available for the requested dates' }, { status: 409 })
    }

    // Compute new total from room rates
    const room = booking.room
    const nightlyRate: number = room?.nightly_rate ?? booking.nightly_rate ?? 0
    const cleaningFee: number = room?.cleaning_fee ?? booking.cleaning_fee ?? 0
    const securityDeposit: number = room?.security_deposit ?? booking.security_deposit ?? 0
    const extraGuestFee: number = room?.extra_guest_fee ?? booking.extra_guest_fee ?? 0
    const guestCapacity: number = room?.guest_capacity ?? 4

    const extraGuests = Math.max(0, (guest_count ?? 1) - guestCapacity)
    const extraGuestTotal = extraGuests * extraGuestFee * totalNights

    // Fetch any additional booking_fees snapshot
    const { data: bookingFees } = await supabase
      .from('booking_fees')
      .select('amount')
      .eq('booking_id', params.id)

    const additionalFees = (bookingFees ?? []).reduce((sum: number, f: { amount: number }) => sum + f.amount, 0)

    const newTotal = nightlyRate * totalNights + cleaningFee + securityDeposit + extraGuestTotal + additionalFees
    const priceDelta = Math.round((newTotal - booking.total_amount) * 100) / 100

    // Insert modification request
    const { data: modRequest, error: insertError } = await supabase
      .from('booking_modification_requests')
      .insert({
        booking_id: params.id,
        requested_check_in: check_in,
        requested_check_out: check_out,
        requested_guest_count: guest_count,
        requested_total_nights: totalNights,
        price_delta: priceDelta,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError || !modRequest) {
      console.error('Failed to create modification request:', insertError)
      return NextResponse.json({ error: 'Failed to create modification request' }, { status: 500 })
    }

    evaluateAndQueueEmails('modification_requested', {
      type: 'booking',
      bookingId: params.id,
    }).catch((err) => { console.error('email queue error on modification_requested:', err) })

    return NextResponse.json({
      success: true,
      price_delta: priceDelta,
      new_total: newTotal,
      request_id: modRequest.id,
    })
  } catch (err) {
    console.error(`POST /api/bookings/${params.id}/modify error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
