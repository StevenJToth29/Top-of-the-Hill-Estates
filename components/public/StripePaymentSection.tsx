'use client'

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import type { BookingParams, GuestInfo, PaymentMethodConfig } from '@/types'

interface StripePaymentSectionProps {
  bookingParams: BookingParams
  guestInfo: GuestInfo
  smsConsent: boolean
  marketingConsent: boolean
  availablePaymentMethods: PaymentMethodConfig[]
  isSubmitting: boolean
  setIsSubmitting: (v: boolean) => void
  onValidateBeforePayment?: () => boolean
  onFeeConfirmed: (processingFee: number) => void
  onSuccess: (bookingId: string) => void
  onError: (error: string) => void
  beforeButton?: React.ReactNode
}

export default function StripePaymentSection({
  bookingParams,
  guestInfo,
  smsConsent,
  marketingConsent,
  availablePaymentMethods,
  isSubmitting,
  setIsSubmitting,
  onValidateBeforePayment,
  onFeeConfirmed,
  onSuccess,
  onError,
  beforeButton,
}: StripePaymentSectionProps) {
  const stripe = useStripe()
  const elements = useElements()
  const ph = usePostHog()
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  function calcFee(methodKey: string): number {
    const config = availablePaymentMethods.find((m) => m.method_key === methodKey)
    if (!config) return 0
    const rate = config.fee_percent / 100
    const flat = config.fee_flat
    if (rate === 0 && flat === 0) return 0
    const grandTotalCents = Math.round((bookingParams.amount_to_pay + flat) / (1 - rate) * 100)
    return (grandTotalCents - Math.round(bookingParams.amount_to_pay * 100)) / 100
  }

  async function handleConfirm() {
    if (!stripe || !elements) return
    onError('')

    // Validate guest info fields before touching Stripe
    if (onValidateBeforePayment && !onValidateBeforePayment()) return

    if (!selectedMethod) {
      onError('Please select a payment method.')
      return
    }

    setIsSubmitting(true)

    // Step 1: validate the payment element (triggers card validation UI)
    const { error: submitError } = await elements.submit()
    if (submitError) {
      onError(submitError.message ?? 'Please check your payment details.')
      setIsSubmitting(false)
      return
    }

    // Step 2: create the booking and PaymentIntent server-side
    let clientSecret: string
    let bookingId: string
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: bookingParams.room_id,
          booking_type: bookingParams.booking_type,
          check_in: bookingParams.check_in,
          check_out: bookingParams.check_out,
          total_nights: bookingParams.total_nights,
          guest_count: bookingParams.guests,
          ...guestInfo,
          sms_consent: smsConsent,
          marketing_consent: marketingConsent,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        onError(data.error ?? 'Unable to initialize payment. Please try again.')
        setIsSubmitting(false)
        return
      }
      clientSecret = data.clientSecret
      bookingId = data.bookingId
    } catch (err) {
      ph?.captureException(err instanceof Error ? err : new Error(String(err)), { step: 'create_booking', room_id: bookingParams.room_id })
      onError('Network error. Please check your connection and try again.')
      setIsSubmitting(false)
      return
    }

    // Step 3: record the selected payment method and get the final processing fee
    try {
      const feeRes = await fetch(`/api/bookings/${bookingId}/payment-method`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method_key: selectedMethod }),
      })
      if (!feeRes.ok) {
        const data = await feeRes.json()
        onError(data.error ?? 'Failed to confirm payment method. Please try again.')
        setIsSubmitting(false)
        return
      }
      const feeData = await feeRes.json() as { processing_fee: number; newClientSecret?: string }
      if (feeData.newClientSecret) clientSecret = feeData.newClientSecret
      onFeeConfirmed(feeData.processing_fee)
    } catch (err) {
      ph?.captureException(err instanceof Error ? err : new Error(String(err)), { step: 'record_payment_method', room_id: bookingParams.room_id })
      onError('Network error. Please check your connection and try again.')
      setIsSubmitting(false)
      return
    }

    // Step 4: confirm the payment with Stripe using the newly created clientSecret
    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret,
      redirect: 'if_required',
    })

    if (error) {
      onError(error.message ?? 'Payment failed. Please try again.')
      setIsSubmitting(false)
      return
    }

    // Step 5: server-side confirmation — verify PaymentIntent status and flip booking to confirmed
    try {
      const confirmRes = await fetch(`/api/bookings/${bookingId}/confirm`, { method: 'POST' })
      if (!confirmRes.ok) {
        const data = await confirmRes.json()
        onError(data.error ?? 'Payment succeeded but booking confirmation failed. Please contact support.')
        setIsSubmitting(false)
        return
      }
    } catch (err) {
      ph?.captureException(err instanceof Error ? err : new Error(String(err)), { step: 'confirm_booking', booking_id: bookingId })
      onError('Payment succeeded but confirmation failed. Please contact support.')
      setIsSubmitting(false)
      return
    }

    onSuccess(bookingId)
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{ layout: 'tabs' }}
        onReady={() => {
          const first = availablePaymentMethods[0]
          if (first) {
            setSelectedMethod(first.method_key)
            onFeeConfirmed(calcFee(first.method_key))
          }
        }}
        onChange={(e) => {
          const method = e.value?.type ?? null
          setSelectedMethod(method)
          onFeeConfirmed(method ? calcFee(method) : 0)
        }}
      />

      {beforeButton}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={isSubmitting || !stripe || !elements}
        className="w-full bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold shadow-[0_0_10px_rgba(45,212,191,0.30)] transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Processing…' : 'Complete Booking'}
      </button>
    </div>
  )
}
