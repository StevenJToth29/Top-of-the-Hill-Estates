'use client'

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useState } from 'react'

interface StripePaymentSectionProps {
  onSuccess: (bookingId: string) => void
  onError: (error: string) => void
  onFeeConfirmed: (processingFee: number) => void
  bookingId: string
  isSubmitting: boolean
  setIsSubmitting: (v: boolean) => void
}

export default function StripePaymentSection({
  onSuccess,
  onError,
  onFeeConfirmed,
  bookingId,
  isSubmitting,
  setIsSubmitting,
}: StripePaymentSectionProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  async function handleConfirm() {
    if (!stripe || !elements) return
    onError('')

    if (!selectedMethod) {
      onError('Please select a payment method.')
      return
    }

    setIsSubmitting(true)

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

      const { processing_fee } = await feeRes.json()
      onFeeConfirmed(processing_fee)
    } catch {
      onError('Network error. Please check your connection and try again.')
      setIsSubmitting(false)
      return
    }

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (error) {
      onError(error.message ?? 'Payment failed. Please try again.')
      setIsSubmitting(false)
    } else {
      onSuccess(bookingId)
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{ layout: 'tabs' }}
        onChange={(e) => {
          if (e.value?.type) setSelectedMethod(e.value.type)
        }}
      />

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
