'use client'

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'

interface StripePaymentSectionProps {
  onSuccess: (bookingId: string) => void
  onError: (error: string) => void
  bookingId: string
  isSubmitting: boolean
  setIsSubmitting: (v: boolean) => void
}

export default function StripePaymentSection({
  onSuccess,
  onError,
  bookingId,
  isSubmitting,
  setIsSubmitting,
}: StripePaymentSectionProps) {
  const stripe = useStripe()
  const elements = useElements()

  async function handleConfirm() {
    if (!stripe || !elements) return
    setIsSubmitting(true)

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
      <PaymentElement options={{ layout: 'tabs' }} />

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
