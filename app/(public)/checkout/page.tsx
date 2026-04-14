'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import CheckoutForm from '@/components/public/CheckoutForm'
import CheckoutSummary from '@/components/public/CheckoutSummary'
import { BookingParams, BookingType } from '@/types'

function CheckoutPageInner() {
  const searchParams = useSearchParams()

  function getParam(key: string): string {
    return searchParams.get(key) ?? ''
  }

  function getNumParam(key: string): number {
    return Number(searchParams.get(key) ?? '0')
  }

  const bookingParams: BookingParams = {
    room_id: getParam('room_id'),
    room_slug: getParam('room'),
    booking_type: (getParam('type') as BookingType) || 'short_term',
    check_in: getParam('checkin'),
    check_out: getParam('checkout'),
    guests: getNumParam('guests'),
    nightly_rate: getNumParam('nightly_rate'),
    monthly_rate: getNumParam('monthly_rate'),
    total_nights: getNumParam('total_nights'),
    total_amount: getNumParam('total_amount'),
    amount_to_pay: getNumParam('amount_to_pay'),
    amount_due_at_checkin: getNumParam('amount_due'),
  }

  const roomName = getParam('room_name') || bookingParams.room_slug || 'Your Room'
  const propertyName = getParam('property_name') || 'Top of the Hill Estates'

  return (
    <main className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl font-bold text-on-surface mb-8">
          Complete Your Booking
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(78,205,196,0.06)] rounded-2xl p-6 lg:p-8">
            <CheckoutForm bookingParams={bookingParams} />
          </div>

          <div className="lg:col-span-2">
            <CheckoutSummary
              params={bookingParams}
              roomName={roomName}
              propertyName={propertyName}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-on-surface-variant">Loading checkout…</p>
        </main>
      }
    >
      <CheckoutPageInner />
    </Suspense>
  )
}
