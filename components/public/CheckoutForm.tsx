'use client'

import { Elements } from '@stripe/react-stripe-js'
import { Appearance, loadStripe } from '@stripe/stripe-js'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { BookingParams } from '@/types'
import StripePaymentSection from './StripePaymentSection'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

const appearance: Appearance = {
  theme: 'night',
  variables: {
    colorBackground: '#283646',
    colorText: '#e8eaf0',
    colorPrimary: '#afc9ea',
    borderRadius: '12px',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  },
}

interface GuestInfo {
  first_name: string
  last_name: string
  email: string
  phone: string
}

interface CheckoutFormProps {
  bookingParams: BookingParams
}

type Step = 'guest_info' | 'payment'

export default function CheckoutForm({ bookingParams }: CheckoutFormProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('guest_info')
  const [guestInfo, setGuestInfo] = useState<GuestInfo>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  })
  const [smsConsent, setSmsConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGuestInfoSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!smsConsent) {
      setError('You must consent to non-marketing SMS messages to continue.')
      return
    }
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookingParams,
          ...guestInfo,
          sms_consent: smsConsent,
          marketing_consent: marketingConsent,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Unable to create booking. Please try again.')
        return
      }

      setClientSecret(data.clientSecret)
      setBookingId(data.bookingId)
      setStep('payment')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {step === 'guest_info' && (
        <form onSubmit={handleGuestInfoSubmit} className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-on-surface mb-4">
              Guest Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-on-surface-variant text-sm mb-1" htmlFor="first_name">
                  First Name
                </label>
                <input
                  id="first_name"
                  type="text"
                  name="first_name"
                  required
                  autoComplete="given-name"
                  value={guestInfo.first_name}
                  onChange={(e) => setGuestInfo((p) => ({ ...p, first_name: e.target.value }))}
                  className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="block text-on-surface-variant text-sm mb-1" htmlFor="last_name">
                  Last Name
                </label>
                <input
                  id="last_name"
                  type="text"
                  name="last_name"
                  required
                  autoComplete="family-name"
                  value={guestInfo.last_name}
                  onChange={(e) => setGuestInfo((p) => ({ ...p, last_name: e.target.value }))}
                  className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
                  placeholder="Smith"
                />
              </div>
              <div>
                <label className="block text-on-surface-variant text-sm mb-1" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  value={guestInfo.email}
                  onChange={(e) => setGuestInfo((p) => ({ ...p, email: e.target.value }))}
                  className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <label className="block text-on-surface-variant text-sm mb-1" htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  required
                  autoComplete="tel"
                  value={guestInfo.phone}
                  onChange={(e) => setGuestInfo((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 bg-surface-highest/40 backdrop-blur-xl rounded-xl p-4 cursor-pointer">
              <input
                type="checkbox"
                name="sms_consent"
                required
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-secondary cursor-pointer"
              />
              <span className="text-on-surface-variant text-sm leading-relaxed">
                By checking this box, I consent to receive non-marketing text messages from Top of
                the Hill Estates, LLC about wifi instructions, rental inquiry, application status,
                scheduling and account-related updates. Message frequency varies, message &amp; data
                rates may apply. Text HELP for assistance, reply STOP to opt out.{' '}
                <a href="/privacypolicy" className="underline hover:text-secondary transition-colors">
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a
                  href="/termsandconditions"
                  className="underline hover:text-secondary transition-colors"
                >
                  Terms of Service
                </a>
                <span className="text-error ml-1">*</span>
              </span>
            </label>

            <label className="flex items-start gap-3 bg-surface-highest/40 backdrop-blur-xl rounded-xl p-4 cursor-pointer">
              <input
                type="checkbox"
                name="marketing_consent"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-secondary cursor-pointer"
              />
              <span className="text-on-surface-variant text-sm leading-relaxed">
                By checking this box, I consent to receive marketing and promotional messages
                including special offers, discounts, new product updates among others from Top of
                the Hill Estates, LLC at the phone number provided. Frequency may vary. Message
                &amp; data rates may apply. Text HELP for assistance, reply STOP to opt out.{' '}
                <a href="/privacypolicy" className="underline hover:text-secondary transition-colors">
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a
                  href="/termsandconditions"
                  className="underline hover:text-secondary transition-colors"
                >
                  Terms of Service
                </a>
              </span>
            </label>
          </div>

          {error && (
            <p className="text-error text-sm rounded-xl bg-error-container/30 px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold shadow-[0_0_10px_rgba(175,201,234,0.30)] transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Checking availability…' : 'Continue to Payment'}
          </button>
        </form>
      )}

      {step === 'payment' && clientSecret && bookingId && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('guest_info')}
              className="text-secondary text-sm underline hover:opacity-80 transition-opacity"
            >
              ← Back
            </button>
            <h2 className="font-display text-xl font-semibold text-on-surface">Payment</h2>
          </div>

          {error && (
            <p className="text-error text-sm rounded-xl bg-error-container/30 px-4 py-3">
              {error}
            </p>
          )}

          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <StripePaymentSection
              bookingId={bookingId}
              isSubmitting={isSubmitting}
              setIsSubmitting={setIsSubmitting}
              onSuccess={(id) => router.push(`/booking/confirmation?booking_id=${id}`)}
              onError={setError}
            />
          </Elements>
        </div>
      )}
    </div>
  )
}
