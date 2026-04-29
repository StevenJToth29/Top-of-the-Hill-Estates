'use client'

import { Elements } from '@stripe/react-stripe-js'
import { Appearance, loadStripe } from '@stripe/stripe-js'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BookingParams, GuestInfo, PaymentMethodConfig } from '@/types'
import StripePaymentSection from './StripePaymentSection'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

const appearance: Appearance = {
  theme: 'night',
  variables: {
    colorBackground: '#172D46',
    colorText: '#F8FAFC',
    colorPrimary: '#2DD4BF',
    colorDanger: '#FF7675',
    borderRadius: '12px',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  },
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
  initialFirstName?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateGuestInfo(info: GuestInfo): FieldErrors {
  const errors: FieldErrors = {}
  if (!info.guest_first_name.trim()) errors.guest_first_name = 'First name is required.'
  if (!info.guest_last_name.trim()) errors.guest_last_name = 'Last name is required.'
  if (!info.guest_email.trim()) errors.guest_email = 'Email address is required.'
  else if (!EMAIL_RE.test(info.guest_email.trim())) errors.guest_email = 'Please enter a valid email address.'
  const digits = info.guest_phone.replace(/\D/g, '')
  if (!info.guest_phone.trim()) errors.guest_phone = 'Phone number is required.'
  else if (digits.length < 10) errors.guest_phone = 'Please enter a valid phone number (at least 10 digits).'
  return errors
}

export default function CheckoutForm({
  bookingParams,
  onProcessingFeeSet,
  availablePaymentMethods,
  initialFirstName = '',
}: CheckoutFormProps) {
  const router = useRouter()
  const [guestInfo, setGuestInfo] = useState<GuestInfo>({
    guest_first_name: initialFirstName,
    guest_last_name: '',
    guest_email: '',
    guest_phone: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [smsConsent, setSmsConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField<K extends keyof GuestInfo>(key: K, value: GuestInfo[K]) {
    setGuestInfo((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const inputBase =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50'
  const inputError =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-error ring-1 ring-error/60'

  function inputClass(field: keyof FieldErrors) {
    return fieldErrors[field] ? inputError : inputBase
  }

  function validateBeforePayment(): boolean {
    const errors = validateGuestInfo(guestInfo)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return false
    }
    return true
  }

  const elementsOptions = {
    mode: 'payment' as const,
    amount: Math.round(bookingParams.amount_to_pay * 100),
    currency: 'usd',
    paymentMethodTypes: availablePaymentMethods.map((m) => m.method_key),
    appearance,
  }

  return (
    <div className="space-y-8">
      {/* ── Guest Information ── */}
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

      {/* ── Payment ── */}
      <div className="border-t border-outline-variant pt-8">
        <h2 className="font-display text-xl font-semibold text-on-surface mb-4">Payment</h2>

        <div className="space-y-6">
          <Elements stripe={stripePromise} options={elementsOptions}>
            <StripePaymentSection
              bookingParams={bookingParams}
              guestInfo={guestInfo}
              smsConsent={smsConsent}
              marketingConsent={marketingConsent}
              availablePaymentMethods={availablePaymentMethods}
              isSubmitting={isSubmitting}
              setIsSubmitting={setIsSubmitting}
              onValidateBeforePayment={validateBeforePayment}
              onFeeConfirmed={onProcessingFeeSet}
              onSuccess={(id) =>
                router.push(
                  `/booking/apply/${id}?email=${encodeURIComponent(guestInfo.guest_email)}`,
                )
              }
              onError={setError}
              beforeButton={
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
                      <a href="/termsandconditions" className="underline hover:text-secondary transition-colors duration-150">
                        Terms of Service
                      </a>
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
                      <a href="/termsandconditions" className="underline hover:text-secondary transition-colors duration-150">
                        Terms of Service
                      </a>
                    </span>
                  </label>
                </div>
              }
            />
          </Elements>
        </div>
      </div>

      {error && (
        <p className="text-error text-sm rounded-xl bg-error-container/30 px-4 py-3">
          {error}
        </p>
      )}
    </div>
  )
}
