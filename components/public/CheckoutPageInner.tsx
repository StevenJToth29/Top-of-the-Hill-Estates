'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CheckoutForm from '@/components/public/CheckoutForm'
import CheckoutSummary from '@/components/public/CheckoutSummary'
import { BookingParams, BookingType, PaymentMethodConfig, RoomFee } from '@/types'

interface CheckoutPageInnerProps {
  checkinTime: string
  checkoutTime: string
  shortTermMethods: PaymentMethodConfig[]
  longTermMethods: PaymentMethodConfig[]
}

export default function CheckoutPageInner({
  checkinTime,
  checkoutTime,
  shortTermMethods,
  longTermMethods,
}: CheckoutPageInnerProps) {
  const searchParams = useSearchParams()

  function getParam(key: string): string {
    return searchParams.get(key) ?? ''
  }

  function getNumParam(key: string): number {
    return Number(searchParams.get(key) ?? '0')
  }

  const bookingType = (getParam('type') as BookingType) || 'short_term'
  const availablePaymentMethods =
    bookingType === 'long_term' ? longTermMethods : shortTermMethods

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
              ['short_term', 'long_term', 'both'].includes(f.booking_type),
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
  const initialFirstName = getParam('first_name')

  const [processingFee, setProcessingFee] = useState(() => {
    const first = availablePaymentMethods[0]
    if (!first || (first.fee_percent === 0 && first.fee_flat === 0)) return 0
    const base = bookingParams.amount_to_pay
    const rate = first.fee_percent / 100
    const flat = first.fee_flat
    const grandTotalCents = Math.round((base + flat) / (1 - rate) * 100)
    return (grandTotalCents - Math.round(base * 100)) / 100
  })

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
        <a
          href={(() => {
            if (!bookingParams.room_slug) return '/rooms'
            const p = new URLSearchParams()
            if (bookingParams.check_in) p.set('checkin', bookingParams.check_in)
            if (bookingParams.check_out) p.set('checkout', bookingParams.check_out)
            if (bookingParams.guests) p.set('guests', String(bookingParams.guests))
            const qs = p.toString()
            return `/rooms/${bookingParams.room_slug}${qs ? `?${qs}` : ''}`
          })()}
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to room
        </a>
        <h1 className="font-display text-3xl font-bold text-on-surface mb-4">
          Complete Your Booking
        </h1>
        <div className="bg-surface-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface-variant border border-outline/50 mb-8">
          <span className="font-semibold text-on-surface">Approval required</span> — your card will be authorized but not charged until your booking application is reviewed and approved.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-6 lg:p-8">
            <CheckoutForm
              bookingParams={bookingParams}
              onProcessingFeeSet={setProcessingFee}
              availablePaymentMethods={availablePaymentMethods}
              initialFirstName={initialFirstName}
            />
          </div>

          <div className="lg:col-span-2">
            <CheckoutSummary
              params={bookingParams}
              roomName={roomName}
              propertyName={propertyName}
              checkinTime={checkinTime}
              checkoutTime={checkoutTime}
              processingFee={processingFee}
              availablePaymentMethods={availablePaymentMethods}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
