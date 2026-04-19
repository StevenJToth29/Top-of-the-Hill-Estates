'use client'

import { Elements } from '@stripe/react-stripe-js'
import { Appearance, loadStripe } from '@stripe/stripe-js'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { BookingParams, PaymentMethodConfig } from '@/types'
import StripePaymentSection from './StripePaymentSection'
import PaymentMethodFeeInfo from './PaymentMethodFeeInfo'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

// Stripe appearance: intentionally uses the dark-surface palette so the payment
// iframe feels embedded in the card regardless of public/admin context.
const appearance: Appearance = {
  theme: 'night',
  variables: {
    colorBackground: '#172D46',  /* --color-surface-container (admin) */
    colorText: '#F8FAFC',        /* --color-on-surface (admin) */
    colorPrimary: '#2DD4BF',     /* --color-primary (shared) */
    colorDanger: '#FF7675',      /* --color-error (admin) */
    borderRadius: '12px',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  },
}

interface GuestInfo {
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_phone: string
}

interface FieldErrors {
  guest_first_name?: string
  guest_last_name?: string
  guest_email?: string
  guest_phone?: string
}

interface CheckoutFormProps {
  bookingParams: BookingParams
  onProcessingFeeSet: (fee: number) => void
  availablePaymentMethods: PaymentMethodConfig[]
}

type Step = 'guest_info' | 'payment'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateGuestInfo(info: GuestInfo): FieldErrors {
  const errors: FieldErrors = {}

  if (!info.guest_first_name.trim()) {
    errors.guest_first_name = 'First name is required.'
  }

  if (!info.guest_last_name.trim()) {
    errors.guest_last_name = 'Last name is required.'
  }

  if (!info.guest_email.trim()) {
    errors.guest_email = 'Email address is required.'
  } else if (!EMAIL_RE.test(info.guest_email.trim())) {
    errors.guest_email = 'Please enter a valid email address.'
  }

  const digits = info.guest_phone.replace(/\D/g, '')
  if (!info.guest_phone.trim()) {
    errors.guest_phone = 'Phone number is required.'
  } else if (digits.length < 10) {
    errors.guest_phone = 'Please enter a valid phone number (at least 10 digits).'
  }

  return errors
}

export default function CheckoutForm({ bookingParams, onProcessingFeeSet, availablePaymentMethods }: CheckoutFormProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('guest_info')
  const [guestInfo, setGuestInfo] = useState<GuestInfo>({
    guest_first_name: '',
    guest_last_name: '',
    guest_email: '',
    guest_phone: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [smsConsent, setSmsConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField<K extends keyof GuestInfo>(key: K, value: GuestInfo[K]) {
    setGuestInfo((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  async function handleGuestInfoSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const errors = validateGuestInfo(guestInfo)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    if (!smsConsent) {
      setError('You must consent to non-marketing SMS messages to continue.')
      return
    }

    setIsSubmitting(true)

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
        setError(data.error ?? 'Unable to create booking. Please try again.')
        return
      }

      setClientSecret(data.clientSecret)
      setBookingId(data.bookingId)
      onProcessingFeeSet(0)
      setStep('payment')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputBase =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50'
  const inputError =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-error ring-1 ring-error/60'

  function inputClass(field: keyof FieldErrors) {
    return fieldErrors[field] ? inputError : inputBase
  }

  return (
    <div className="space-y-8">
      {step === 'guest_info' && (
        <form onSubmit={handleGuestInfoSubmit} noValidate className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-on-surface mb-4">
              Guest Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-on-surface-variant text-sm mb-1" htmlFor="guest_first_name">
                  First Name <span className="text-error">*</span>
                </label>
                <input
                  id="guest_first_name"
                  type="text"
                  name="guest_first_name"
                  autoComplete="given-name"
                  value={guestInfo.guest_first_name}
                  onChange={(e) => updateField('guest_first_name', e.target.value)}
                  className={inputClass('guest_first_name')}
                  placeholder="Jane"
                />
                {fieldErrors.guest_first_name && (
                  <p className="text-error text-xs mt-1">{fieldErrors.guest_first_name}</p>
                )}
              </div>
              <div>
                <label className="block text-on-surface-variant text-sm mb-1" htmlFor="guest_last_name">
                  Last Name <span className="text-error">*</span>
                </label>
                <input
                  id="guest_last_name"
                  type="text"
                  name="guest_last_name"
                  autoComplete="family-name"
                  value={guestInfo.guest_last_name}
                  onChange={(e) => updateField('guest_last_name', e.target.value)}
                  className={inputClass('guest_last_name')}
                  placeholder="Smith"
                />
                {fieldErrors.guest_last_name && (
                  <p className="text-error text-xs mt-1">{fieldErrors.guest_last_name}</p>
                )}
              </div>
              <div>
                <label className="block text-on-surface-variant text-sm mb-1" htmlFor="email">
                  Email <span className="text-error">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={guestInfo.guest_email}
                  onChange={(e) => updateField('guest_email', e.target.value)}
                  className={inputClass('guest_email')}
                  placeholder="jane@example.com"
                />
                {fieldErrors.guest_email && (
                  <p className="text-error text-xs mt-1">{fieldErrors.guest_email}</p>
                )}
              </div>
              <div>
                <label className="block text-on-surface-variant text-sm mb-1" htmlFor="phone">
                  Phone <span className="text-error">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  value={guestInfo.guest_phone}
                  onChange={(e) => updateField('guest_phone', e.target.value.replace(/[^\d\s\+\-\(\)\.]/g, ''))}
                  className={inputClass('guest_phone')}
                  placeholder="+1 (555) 000-0000"
                />
                {fieldErrors.guest_phone && (
                  <p className="text-error text-xs mt-1">{fieldErrors.guest_phone}</p>
                )}
              </div>
            </div>
          </div>

          <PaymentMethodFeeInfo methods={availablePaymentMethods} />

          <div className="space-y-3">
            <label className="flex items-start gap-3 bg-surface-highest/40 backdrop-blur-xl rounded-xl p-4 cursor-pointer">
              <input
                type="checkbox"
                name="sms_consent"
                checked={smsConsent}
                onChange={(e) => { setSmsConsent(e.target.checked); setError(null) }}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-secondary cursor-pointer"
              />
              <span className="text-on-surface-variant text-sm leading-relaxed">
                By checking this box, I consent to receive non-marketing text messages from Top of
                the Hill Estates, LLC about wifi instructions, rental inquiry, application status,
                scheduling and account-related updates. Message frequency varies, message &amp; data
                rates may apply. Text HELP for assistance, reply STOP to opt out.{' '}
                <a href="/privacypolicy" className="underline hover:text-secondary transition-colors duration-150">
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a
                  href="/termsandconditions"
                  className="underline hover:text-secondary transition-colors duration-150"
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
                <a href="/privacypolicy" className="underline hover:text-secondary transition-colors duration-150">
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a
                  href="/termsandconditions"
                  className="underline hover:text-secondary transition-colors duration-150"
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
            className="w-full bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold shadow-[0_0_10px_rgba(45,212,191,0.30)] hover:opacity-90 transition-opacity duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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

          <p className="text-on-surface-variant/60 text-xs italic">
            Processing fees are non-refundable.
          </p>

          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <StripePaymentSection
              bookingId={bookingId}
              isSubmitting={isSubmitting}
              setIsSubmitting={setIsSubmitting}
              onFeeConfirmed={onProcessingFeeSet}
              onSuccess={(id) =>
                router.push(
                  `/booking/confirmation?booking_id=${id}&guest_email=${encodeURIComponent(guestInfo.guest_email)}`,
                )
              }
              onError={setError}
            />
          </Elements>
        </div>
      )}
    </div>
  )
}
