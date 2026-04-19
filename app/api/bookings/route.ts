import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/availability'
import { syncToGHL } from '@/lib/ghl'
import type { Booking, BookingType, PaymentMethodConfig } from '@/types'

interface CreateBookingBody {
  room_id: string
  booking_type: BookingType
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_phone: string
  check_in: string
  check_out: string
  total_nights: number
  guest_count: number
  sms_consent: boolean
  marketing_consent: boolean
}

export async function POST(request: Request) {
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
      guest_count = 1,
      sms_consent,
      marketing_consent,
    } = body

    const safeGuestCount = Math.max(1, Math.floor(Number(guest_count) || 1))
    const safeTotalNights = Math.max(1, Math.floor(Number(total_nights) || 1))

    const supabase = createServiceRoleClient()

    // Fetch authoritative room rates and fees — never trust client-supplied prices
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('nightly_rate, monthly_rate, cleaning_fee, security_deposit, extra_guest_fee, property:properties(platform_fee_percent, stripe_account:stripe_accounts(stripe_account_id))')
      .eq('id', room_id)
      .eq('is_active', true)
      .single()

    if (roomError || !room) {
      console.error('Room lookup failed:', roomError)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const available = await isRoomAvailable(room_id, check_in, check_out)
    if (!available) {
      return NextResponse.json({ error: 'Room is not available for the selected dates' }, { status: 409 })
    }

    const { data: paymentMethodConfigs, error: configsError } = await supabase
      .from('payment_method_configs')
      .select('id, method_key, label, fee_percent, fee_flat, sort_order')
      .eq('booking_type', booking_type)
      .eq('is_enabled', true)
      .order('sort_order')

    if (configsError) {
      console.error('Failed to fetch payment method configs:', configsError)
      return NextResponse.json({ error: 'Failed to fetch payment configuration' }, { status: 500 })
    }

    const enabledMethods = (paymentMethodConfigs ?? []) as PaymentMethodConfig[]

    if (enabledMethods.length === 0) {
      return NextResponse.json(
        { error: 'No payment methods available for this booking type. Please contact support.' },
        { status: 422 },
      )
    }

    // Fetch applicable generic fees from DB
    const { data: roomFees, error: feesError } = await supabase
      .from('room_fees')
      .select('id, label, amount, booking_type')
      .eq('room_id', room_id)
      .in('booking_type', [booking_type, 'both'])

    if (feesError) {
      console.error('Failed to fetch room fees:', feesError)
      return NextResponse.json({ error: 'Failed to fetch room fees' }, { status: 500 })
    }

    const applicableFees = roomFees ?? []
    const genericFeesTotal = applicableFees.reduce((sum, f) => sum + Number(f.amount), 0)

    const nightly_rate = room.nightly_rate
    const monthly_rate = room.monthly_rate
    const cleaning_fee = room.cleaning_fee ?? 0
    const security_deposit = room.security_deposit ?? 0
    const extra_guest_fee = room.extra_guest_fee ?? 0
    const extraGuests = Math.max(0, safeGuestCount - 1)

    let total_amount: number
    let snapshotCleaningFee: number
    let snapshotSecurityDeposit: number
    let snapshotExtraGuestFee: number

    if (booking_type === 'short_term') {
      const extra_guest_total = extraGuests * extra_guest_fee * safeTotalNights
      total_amount = safeTotalNights * nightly_rate + cleaning_fee + extra_guest_total + genericFeesTotal
      snapshotCleaningFee = cleaning_fee
      snapshotSecurityDeposit = 0
      snapshotExtraGuestFee = extra_guest_total
    } else {
      const extra_guest_total = extraGuests * extra_guest_fee
      total_amount = monthly_rate + security_deposit + extra_guest_total + genericFeesTotal
      snapshotCleaningFee = 0
      snapshotSecurityDeposit = security_deposit
      snapshotExtraGuestFee = extra_guest_total
    }

    const amount_due_at_checkin = 0

    const roomWithProperty = room as typeof room & {
      property?: {
        platform_fee_percent?: number
        stripe_account?: { stripe_account_id?: string } | null
      }
    }
    const connectedAccountId = roomWithProperty?.property?.stripe_account?.stripe_account_id
    const platformFeePercent = Number(roomWithProperty?.property?.platform_fee_percent ?? 0)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total_amount * 100),
      currency: 'usd',
      payment_method_types: enabledMethods.map((m) => m.method_key),
      metadata: { room_id, booking_type, guest_email },
      ...(connectedAccountId && {
        transfer_data: { destination: connectedAccountId },
        application_fee_amount: Math.round(total_amount * (platformFeePercent / 100) * 100),
      }),
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
        total_nights: safeTotalNights,
        nightly_rate,
        monthly_rate,
        cleaning_fee: snapshotCleaningFee,
        security_deposit: snapshotSecurityDeposit,
        extra_guest_fee: snapshotExtraGuestFee,
        guest_count: safeGuestCount,
        total_amount,
        processing_fee: 0,
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

    // Snapshot applicable generic fees
    if (applicableFees.length > 0) {
      const { error: feesInsertError } = await supabase.from('booking_fees').insert(
        applicableFees.map((f) => ({
          booking_id: booking.id,
          label: f.label,
          amount: f.amount,
        }))
      )
      if (feesInsertError) {
        console.error('Failed to snapshot booking fees:', feesInsertError)
        return NextResponse.json({ error: 'Failed to record booking fees' }, { status: 500 })
      }
    }

    // Sync to GHL in the background — non-blocking so it doesn't delay the response
    syncToGHL(booking as Booking).catch((err) => {
      console.error('GHL sync error on booking creation:', err)
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      bookingId: booking.id,
      processing_fee: 0,
      available_payment_methods: enabledMethods,
    })
  } catch (err) {
    console.error('POST /api/bookings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
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
