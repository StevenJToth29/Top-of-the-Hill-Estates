import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { isRoomAvailableExcluding } from '@/lib/availability'
import { OPEN_ENDED_DATE } from '@/lib/format'
import { evaluateAndQueueEmails } from '@/lib/email-queue'
import type { Booking } from '@/types'

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
    total += overrideMap[cur.toISOString().slice(0, 10)] ?? baseRate
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return total
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { id } = await params
    const supabase = createServiceRoleClient()

    // Fetch existing booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const b = booking as Booking

    if (b.status === 'cancelled' || b.status === 'completed') {
      return NextResponse.json(
        { error: `Cannot edit a ${b.status} booking` },
        { status: 400 },
      )
    }

    // Parse incoming fields with fallback to existing values
    const checkIn = (body.check_in as string | undefined) ?? b.check_in
    const checkOut = (body.check_out as string | undefined) ?? b.check_out
    const guestFirstName = (body.guest_first_name as string | undefined) ?? b.guest_first_name
    const guestLastName = (body.guest_last_name as string | undefined) ?? b.guest_last_name
    const guestEmail = (body.guest_email as string | undefined) ?? b.guest_email
    const guestPhone = (body.guest_phone as string | undefined) ?? b.guest_phone
    const guestCount = typeof body.guest_count === 'number'
      ? Math.max(1, Math.floor(body.guest_count))
      : b.guest_count
    const notes = Object.prototype.hasOwnProperty.call(body, 'notes')
      ? (body.notes as string | null)
      : b.notes ?? null

    // Validate dates
    if (checkOut !== OPEN_ENDED_DATE && checkIn >= checkOut) {
      return NextResponse.json({ error: 'check_in must be before check_out' }, { status: 400 })
    }

    // Availability check (excluding this booking's own dates)
    // Only runs when dates actually changed — price-only edits skip this entirely.
    // Note: open-ended bookings cap the check at 730 days from today because
    // isRoomAvailableExcluding cannot handle '9999-12-31' as the end date.
    if (checkIn !== b.check_in || checkOut !== b.check_out) {
      const CAP_DAYS = 730
      const checkOutForAvailability =
        checkOut === OPEN_ENDED_DATE
          ? (() => {
              const cap = new Date()
              cap.setUTCDate(cap.getUTCDate() + CAP_DAYS)
              return cap.toISOString().split('T')[0]
            })()
          : checkOut
      const available = await isRoomAvailableExcluding(b.room_id, checkIn, checkOutForAvailability, b.id)
      if (!available) {
        return NextResponse.json(
          { error: 'Room is not available for the new dates' },
          { status: 409 },
        )
      }
    }

    // Fetch authoritative current room rates
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('nightly_rate, monthly_rate, cleaning_fee, security_deposit, extra_guest_fee, property:properties(stripe_account_id, platform_fee_percent)')
      .eq('id', b.room_id)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const { data: bookingFees } = await supabase
      .from('booking_fees')
      .select('amount')
      .eq('booking_id', b.id)

    const additionalFees = (bookingFees ?? []).reduce(
      (sum: number, f: { amount: number }) => sum + f.amount,
      0,
    )

    const extraGuests = Math.max(0, guestCount - 1)
    const extraGuestFee = room.extra_guest_fee ?? 0

    // Recalculate total
    let newTotal: number
    let newTotalNights: number
    let monthlyRateSnapshot = b.monthly_rate ?? 0

    if (b.booking_type === 'short_term' && checkOut !== OPEN_ENDED_DATE) {
      // Fetch price overrides for the new date range
      const { data: overrides } = await supabase
        .from('date_overrides')
        .select('date, price_override')
        .eq('room_id', b.room_id)
        .gte('date', checkIn)
        .lt('date', checkOut)
        .not('price_override', 'is', null)

      const overrideMap: Record<string, number> = {}
      for (const o of overrides ?? []) {
        if (o.price_override != null) overrideMap[o.date] = Number(o.price_override)
      }

      const nightlySubtotal = computeNightlySubtotal(checkIn, checkOut, room.nightly_rate, overrideMap)
      const [ciY, ciM, ciD] = checkIn.split('-').map(Number)
      const [coY, coM, coD] = checkOut.split('-').map(Number)
      newTotalNights = Math.round(
        (Date.UTC(coY, coM - 1, coD) - Date.UTC(ciY, ciM - 1, ciD)) / 86400000,
      )
      const cleaningFee = room.cleaning_fee ?? 0
      newTotal = nightlySubtotal + cleaningFee + extraGuestFee * extraGuests * newTotalNights + additionalFees
    } else {
      if (b.booking_type === 'long_term' && body.admin_monthly_amount !== undefined) {
        const adminAmount = Number(body.admin_monthly_amount)
        if (!isFinite(adminAmount) || adminAmount <= 0) {
          return NextResponse.json(
            { error: 'admin_monthly_amount must be a positive number' },
            { status: 400 },
          )
        }
        monthlyRateSnapshot = adminAmount
        // admin_monthly_amount is all-in — extra_guest_fee excluded (admin sets fully negotiated amount)
        newTotal = adminAmount + additionalFees
      } else {
        // long_term: only extra_guest_fee changes with guest count; base is monthly_rate + security_deposit
        const securityDeposit = room.security_deposit ?? 0
        newTotal = room.monthly_rate + securityDeposit + extraGuestFee * extraGuests + additionalFees
      }
      if (checkOut === OPEN_ENDED_DATE) {
        newTotalNights = 0
      } else {
        const [ltciY, ltciM, ltciD] = checkIn.split('-').map(Number)
        const [ltcoY, ltcoM, ltcoD] = checkOut.split('-').map(Number)
        newTotalNights = Math.round(
          (Date.UTC(ltcoY, ltcoM - 1, ltcoD) - Date.UTC(ltciY, ltciM - 1, ltciD)) / 86400000,
        )
      }
    }

    newTotal += b.processing_fee ?? 0

    const priceDelta = newTotal - b.total_amount   // price change, drives Stripe action
    const amountDueAtCheckin = Math.max(0, newTotal - b.amount_paid)  // what guest still owes

    // Update booking record
    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        check_in: checkIn,
        check_out: checkOut,
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        guest_count: guestCount,
        total_nights: newTotalNights,
        monthly_rate: monthlyRateSnapshot,
        total_amount: newTotal,
        amount_due_at_checkin: amountDueAtCheckin,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', b.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      console.error('Edit booking update error:', updateError)
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }

    // Payment adjustments (non-blocking — don't fail the edit if Stripe errors)
    if (b.stripe_payment_intent_id && Math.abs(priceDelta) >= 0.01) {
      if (priceDelta < 0) {
        // Price decreased — issue partial refund
        try {
          await stripe.refunds.create({
            payment_intent: b.stripe_payment_intent_id,
            amount: Math.round(Math.abs(priceDelta) * 100),
            reverse_transfer: true,
          })
          await supabase
            .from('bookings')
            .update({ amount_paid: Math.max(0, b.amount_paid - Math.abs(priceDelta)), amount_due_at_checkin: 0 })
            .eq('id', b.id)
        } catch (stripeErr) {
          console.error('Stripe refund error on booking edit:', stripeErr)
        }
      } else {
        // Price increased — create Stripe Checkout Session for the delta and email guest
        try {
          const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{
              price_data: {
                currency: 'usd',
                product_data: { name: `Additional charge — booking ${b.id.slice(0, 8).toUpperCase()}` },
                unit_amount: Math.round(priceDelta * 100),
              },
              quantity: 1,
            }],
            customer_email: guestEmail,
            ...(((room as any).property?.stripe_account_id)
              ? {
                  payment_intent_data: {
                    application_fee_amount: Math.round(
                      priceDelta * 100 * (((room as any).property.platform_fee_percent ?? 0) / 100)
                    ),
                    transfer_data: { destination: (room as any).property.stripe_account_id },
                  },
                }
              : {}),
            metadata: { booking_id: b.id, type: 'booking_edit_additional_charge' },
            success_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/booking-confirmed`,
            cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}`,
          })
          const paymentLink = session.url
          if (paymentLink) {
            evaluateAndQueueEmails('booking_payment_request', {
              type: 'booking_payment_request',
              bookingId: b.id,
              paymentAmount: `$${priceDelta.toFixed(2)}`,
              paymentLink,
            }).catch((err) => console.error('email queue error on payment_request:', err))
          } else {
            console.error('Stripe session.url was null — payment request email not sent')
          }
        } catch (stripeErr) {
          console.error('Stripe payment intent error on booking edit:', stripeErr)
        }
      }
    }

    return NextResponse.json({ booking: updated })
  } catch (err) {
    console.error('PATCH /api/admin/bookings/[id]/edit error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
