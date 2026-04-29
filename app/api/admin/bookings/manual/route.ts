import { NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/availability'
import { OPEN_ENDED_DATE } from '@/lib/format'
import { evaluateAndQueueEmails, seedReminderEmails } from '@/lib/email-queue'
import { notifyGHLBookingConfirmed } from '@/lib/ghl'
import type { BookingType, Booking } from '@/types'

function computeNightlySubtotal(
  checkIn: string,
  checkOut: string,
  baseRate: number,
  overrideMap: Record<string, number>,
): number {
  const [ciY, ciM, ciD] = checkIn.split('-').map(Number)
  const [coY, coM, coD] = checkOut.split('-').map(Number)
  const start = new Date(Date.UTC(ciY, ciM - 1, ciD))
  const end = new Date(Date.UTC(coY, coM - 1, coD))
  let total = 0
  const MAX_NIGHTS = 365
  if ((end.getTime() - start.getTime()) / 86400000 > MAX_NIGHTS) {
    return baseRate * MAX_NIGHTS
  }
  const cur = new Date(start)
  while (cur < end) {
    const dateStr = cur.toISOString().slice(0, 10)
    total += overrideMap[dateStr] ?? baseRate
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return total
}

export async function POST(request: Request) {
  try {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const required = [
    'room_id',
    'booking_type',
    'guest_first_name',
    'guest_last_name',
    'guest_email',
    'guest_phone',
    'check_in',
  ] as const

  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  // Validate booking_type before using it
  if (body.booking_type !== 'short_term' && body.booking_type !== 'long_term') {
    return NextResponse.json({ error: 'Invalid booking_type' }, { status: 400 })
  }

  // Compute amounts server-side
  const bookingType = body.booking_type as BookingType

  // check_out is required for short-term; for long-term it defaults to open-ended
  const checkOut = body.check_out
    ? (body.check_out as string)
    : bookingType === 'long_term'
      ? OPEN_ENDED_DATE
      : null

  if (!checkOut) {
    return NextResponse.json({ error: 'Missing required field: check_out' }, { status: 400 })
  }

  const checkIn = body.check_in as string
  if (checkOut !== OPEN_ENDED_DATE && checkOut <= checkIn) {
    return NextResponse.json({ error: 'Check-out must be after check-in' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Fetch authoritative room rates — never trust client-supplied prices
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('nightly_rate, monthly_rate, cleaning_fee, security_deposit, extra_guest_fee')
    .eq('id', body.room_id as string)
    .eq('is_active', true)
    .single()

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  // Check availability before creating booking (skip for open-ended long-term)
  if (checkOut !== OPEN_ENDED_DATE) {
    const available = await isRoomAvailable(
      body.room_id as string,
      checkIn,
      checkOut,
    )
    if (!available) {
      return NextResponse.json({ error: 'Room is not available for the selected dates' }, { status: 409 })
    }
  }

  const totalNights = checkOut === OPEN_ENDED_DATE ? 0 : Number(body.total_nights ?? 1)
  const guestCount = Math.max(1, Number(body.guest_count ?? 1))
  const cleaning_fee = room.cleaning_fee ?? 0
  const security_deposit = room.security_deposit ?? 0
  const extra_guest_fee = room.extra_guest_fee ?? 0
  const extraGuests = Math.max(0, guestCount - 1)

  // Fetch per-night price overrides for short-term bookings
  let overrideMap: Record<string, number> = {}
  if (bookingType === 'short_term' && checkOut !== OPEN_ENDED_DATE) {
    const { data: overrides } = await supabase
      .from('date_overrides')
      .select('date, price_override')
      .eq('room_id', body.room_id as string)
      .gte('date', body.check_in as string)
      .lt('date', checkOut)
      .not('price_override', 'is', null)

    for (const o of overrides ?? []) {
      if (o.price_override != null) overrideMap[o.date] = Number(o.price_override)
    }
  }

  let total_amount: number
  let snapshotCleaningFee: number
  let snapshotSecurityDeposit: number
  let snapshotExtraGuestFee: number
  let monthlyRateSnapshot = room.monthly_rate

  if (bookingType === 'short_term') {
    const nightlySubtotal = computeNightlySubtotal(
      body.check_in as string,
      checkOut,
      room.nightly_rate,
      overrideMap,
    )
    const extraGuestTotal = extraGuests * extra_guest_fee * totalNights
    total_amount = nightlySubtotal + cleaning_fee + extraGuestTotal
    snapshotCleaningFee = cleaning_fee
    snapshotSecurityDeposit = 0
    snapshotExtraGuestFee = extraGuestTotal
  } else {
    if (body.admin_monthly_amount !== undefined) {
      const adminAmount = Number(body.admin_monthly_amount)
      if (!isFinite(adminAmount) || adminAmount <= 0) {
        return NextResponse.json(
          { error: 'admin_monthly_amount must be a positive number' },
          { status: 400 },
        )
      }
      monthlyRateSnapshot = adminAmount
      total_amount = adminAmount
      snapshotCleaningFee = 0
      snapshotSecurityDeposit = 0
      snapshotExtraGuestFee = 0
    } else {
      const extraGuestTotal = extraGuests * extra_guest_fee
      total_amount = room.monthly_rate + security_deposit + extraGuestTotal
      snapshotCleaningFee = 0
      snapshotSecurityDeposit = security_deposit
      snapshotExtraGuestFee = extraGuestTotal
    }
  }
  const amount_due_at_checkin = 0

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      room_id: body.room_id,
      booking_type: bookingType,
      guest_first_name: body.guest_first_name,
      guest_last_name: body.guest_last_name,
      guest_email: body.guest_email,
      guest_phone: body.guest_phone,
      sms_consent: body.sms_consent ?? false,
      marketing_consent: body.marketing_consent ?? false,
      source: body.source ?? null,
      notes: body.notes ?? null,
      check_in: body.check_in,
      check_out: checkOut,
      total_nights: totalNights,
      nightly_rate: room.nightly_rate,
      monthly_rate: monthlyRateSnapshot,
      cleaning_fee: snapshotCleaningFee,
      security_deposit: snapshotSecurityDeposit,
      extra_guest_fee: snapshotExtraGuestFee,
      guest_count: guestCount,
      total_amount,
      amount_paid: 0,
      amount_due_at_checkin,
      stripe_payment_intent_id: null,
      stripe_session_id: null,
      status: 'confirmed',
      ghl_contact_id: null,
      cancellation_reason: null,
      cancelled_at: null,
      refund_amount: null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const createdBooking = data as Booking

  notifyGHLBookingConfirmed(createdBooking).catch((err) => {
    console.error('GHL notification error on manual booking:', err)
  })

  evaluateAndQueueEmails('booking_confirmed', {
    type: 'booking',
    bookingId: createdBooking.id,
  }).catch((err) => {
    console.error('email queue error on manual booking_confirmed:', err)
  })

  evaluateAndQueueEmails('admin_new_booking', {
    type: 'booking',
    bookingId: createdBooking.id,
  }).catch((err) => {
    console.error('email queue error on manual admin_new_booking:', err)
  })

  seedReminderEmails(createdBooking.id).catch((err) => {
    console.error('seedReminderEmails error on manual booking:', err)
  })

  return NextResponse.json({ success: true, booking: data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/bookings/manual error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
