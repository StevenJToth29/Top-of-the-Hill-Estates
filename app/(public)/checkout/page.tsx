'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import CheckoutForm from '@/components/public/CheckoutForm'
import CheckoutSummary from '@/components/public/CheckoutSummary'
import { BookingParams, BookingType, RoomFee } from '@/types'

interface CheckoutPageInnerProps {
  checkinTime: string
  checkoutTime: string
}

function CheckoutPageInner({ checkinTime, checkoutTime }: CheckoutPageInnerProps) {
  const searchParams = useSearchParams()

  function getParam(key: string): string {
    return searchParams.get(key) ?? ''
  }

  function getNumParam(key: string): number {
    return Number(searchParams.get(key) ?? '0')
  }

  const bookingType = (getParam('type') as BookingType) || 'short_term'

  const bookingParams: BookingParams = {
    room_id: getParam('room_id'),
    room_slug: getParam('room'),
    booking_type: bookingType,
    check_in: getParam('checkin'),
    check_out: getParam('checkout'),
    guests: getNumParam('guests'),
    nightly_rate: getNumParam('nightly_rate'),
    monthly_rate: getNumParam('monthly_rate'),
    total_nights: getNumParam('total_nights'),
    total_amount: getNumParam('total_amount'),
    amount_to_pay: getNumParam('amount_to_pay'),
    amount_due_at_checkin: getNumParam('amount_due'),
    cleaning_fee: getNumParam('cleaning_fee'),
    security_deposit: getNumParam('security_deposit'),
    extra_guest_fee: getNumParam('extra_guest_fee'),
    fees: (() => {
      try {
        const parsed = JSON.parse(getParam('fees') || '[]')
        if (
          !Array.isArray(parsed) ||
          !parsed.every(
            (f) =>
              typeof f === 'object' &&
              f !== null &&
              typeof f.id === 'string' &&
              typeof f.label === 'string' &&
              typeof f.amount === 'number' &&
              ['short_term', 'long_term', 'both'].includes(f.booking_type)
          )
        ) {
          return []
        }
        return parsed as RoomFee[]
      } catch {
        return []
      }
    })(),
  }

  const roomName = getParam('room_name') || bookingParams.room_slug || 'Your Room'
  const propertyName = getParam('property_name') || 'Top of the Hill Estates'

  // Guard against direct/invalid URL access
  const paramError = (() => {
    if (!bookingParams.room_id) return 'Missing room information. Please start your booking from the room page.'
    if (bookingType === 'short_term') {
      if (!bookingParams.check_in) return 'Missing check-in date. Please start your booking from the room page.'
      if (!bookingParams.check_out) return 'Missing check-out date. Please start your booking from the room page.'
      if (bookingParams.total_nights < 1) return 'Invalid stay length. Please start your booking from the room page.'
    } else {
      if (!bookingParams.check_in) return 'Missing move-in date. Please start your booking from the room page.'
    }
    if (bookingParams.amount_to_pay <= 0) return 'Invalid booking amount. Please start your booking from the room page.'
    return null
  })()

  if (paramError) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <p className="text-on-surface-variant text-sm">{paramError}</p>
          <a
            href="/rooms"
            className="inline-block bg-gradient-to-r from-primary to-secondary text-background font-semibold px-6 py-3 rounded-2xl hover:opacity-90 transition-opacity"
          >
            Browse Rooms
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl font-bold text-on-surface mb-8">
          Complete Your Booking
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-6 lg:p-8">
            <CheckoutForm bookingParams={bookingParams} />
          </div>

          <div className="lg:col-span-2">
            <CheckoutSummary
              params={bookingParams}
              roomName={roomName}
              propertyName={propertyName}
              checkinTime={checkinTime}
              checkoutTime={checkoutTime}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

export default async function CheckoutPage() {
  // Fetch settings server-side so times are available without an extra client fetch
  let checkinTime = '15:00'
  let checkoutTime = '10:00'
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase')
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('site_settings')
      .select('checkin_time, checkout_time')
      .maybeSingle()
    if (data?.checkin_time) checkinTime = data.checkin_time
    if (data?.checkout_time) checkoutTime = data.checkout_time
  } catch {
    // fall through to defaults
  }

  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-on-surface-variant">Loading checkout…</p>
        </main>
      }
    >
      <CheckoutPageInner checkinTime={checkinTime} checkoutTime={checkoutTime} />
    </Suspense>
  )
}
