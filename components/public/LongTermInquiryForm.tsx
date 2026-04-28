'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import DatePicker from './DatePicker'

interface Props {
  roomSlug: string
  roomName: string
  propertyName: string
  initialMoveIn?: string
  initialOccupants?: number
  maxOccupants?: number
  minMoveIn?: string
  blockedDates?: string[]
}

interface FieldErrors {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  move_in?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(
  fields: { first_name: string; last_name: string; email: string; phone: string; move_in: string },
  minMoveIn: string,
): FieldErrors {
  const errors: FieldErrors = {}
  if (!fields.first_name.trim()) errors.first_name = 'First name is required.'
  if (!fields.last_name.trim()) errors.last_name = 'Last name is required.'
  if (!fields.email.trim()) errors.email = 'Email is required.'
  else if (!EMAIL_RE.test(fields.email.trim())) errors.email = 'Please enter a valid email address.'
  const digits = fields.phone.replace(/\D/g, '')
  if (!fields.phone.trim()) errors.phone = 'Phone number is required.'
  else if (digits.length < 10) errors.phone = 'Please enter a valid phone number (at least 10 digits).'
  if (!fields.move_in) errors.move_in = 'Move-in date is required.'
  else if (fields.move_in < minMoveIn)
    errors.move_in = `Move-in date must be on or after ${new Date(minMoveIn + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
  return errors
}

export default function LongTermInquiryForm({
  roomSlug,
  roomName,
  propertyName,
  initialMoveIn = '',
  initialOccupants = 1,
  maxOccupants = 1,
  minMoveIn,
  blockedDates,
}: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const effectiveMin = minMoveIn && minMoveIn > today ? minMoveIn : today
  const router = useRouter()
  const ph = usePostHog()
  const [fields, setFields] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    move_in: initialMoveIn,
  })
  const [occupants, setOccupants] = useState(Math.min(initialOccupants, maxOccupants))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [smsConsent, setSmsConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const errors = validate(fields, effectiveMin)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    if (!smsConsent) {
      setError('You must consent to SMS messages to continue.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          occupants,
          room_slug: roomSlug,
          room_name: roomName,
          property_name: propertyName,
          sms_consent: smsConsent,
          marketing_consent: marketingConsent,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Unable to submit inquiry. Please try again.')
        return
      }
      router.push('/apply/confirmation')
    } catch (err) {
      ph?.captureException(err instanceof Error ? err : new Error(String(err)), { action: 'submit_inquiry', room_slug: roomSlug })
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
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <h2 className="font-display text-xl font-semibold text-on-surface">Your Information</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-on-surface-variant text-sm mb-1" htmlFor="first_name">
            First Name <span className="text-error">*</span>
          </label>
          <input
            id="first_name"
            type="text"
            autoComplete="given-name"
            value={fields.first_name}
            onChange={(e) => updateField('first_name', e.target.value)}
            className={inputClass('first_name')}
            placeholder="Jane"
          />
          {fieldErrors.first_name && (
            <p className="text-error text-xs mt-1">{fieldErrors.first_name}</p>
          )}
        </div>

        <div>
          <label className="block text-on-surface-variant text-sm mb-1" htmlFor="last_name">
            Last Name <span className="text-error">*</span>
          </label>
          <input
            id="last_name"
            type="text"
            autoComplete="family-name"
            value={fields.last_name}
            onChange={(e) => updateField('last_name', e.target.value)}
            className={inputClass('last_name')}
            placeholder="Smith"
          />
          {fieldErrors.last_name && (
            <p className="text-error text-xs mt-1">{fieldErrors.last_name}</p>
          )}
        </div>

        <div>
          <label className="block text-on-surface-variant text-sm mb-1" htmlFor="email">
            Email <span className="text-error">*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={(e) => updateField('email', e.target.value)}
            className={inputClass('email')}
            placeholder="jane@example.com"
          />
          {fieldErrors.email && (
            <p className="text-error text-xs mt-1">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-on-surface-variant text-sm mb-1" htmlFor="phone">
            Phone <span className="text-error">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={fields.phone}
            onChange={(e) => updateField('phone', e.target.value.replace(/[^\d\s+\-.()]/g, ''))}
            className={inputClass('phone')}
            placeholder="+1 (555) 000-0000"
          />
          {fieldErrors.phone && (
            <p className="text-error text-xs mt-1">{fieldErrors.phone}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-on-surface-variant text-sm mb-1">
            Desired Move-in Date <span className="text-error">*</span>
          </label>
          <div
            className={[
              'bg-surface-highest/40 rounded-xl px-4 py-3',
              fieldErrors.move_in ? 'ring-1 ring-error/60' : '',
            ].join(' ')}
          >
            <DatePicker
              label=""
              value={fields.move_in}
              onChange={(d) => updateField('move_in', d)}
              min={effectiveMin}
              placeholder="Select move-in date"
              blockedDates={blockedDates}
            />
          </div>
          {effectiveMin > today && !fieldErrors.move_in && (
            <p className="text-on-surface-variant text-xs mt-1">
              Earliest available:{' '}
              {new Date(effectiveMin + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
          {fieldErrors.move_in && (
            <p className="text-error text-xs mt-1">{fieldErrors.move_in}</p>
          )}
        </div>
      </div>

      {maxOccupants > 1 && (
        <div>
          <p className="text-on-surface-variant text-sm mb-2">
            Number of Occupants <span className="text-error">*</span>
          </p>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: maxOccupants }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setOccupants(n)}
                className={[
                  'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  occupants === n
                    ? 'bg-secondary text-background'
                    : 'bg-surface-highest/40 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest/60',
                ].join(' ')}
              >
                {n} {n === 1 ? 'Occupant' : 'Occupants'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <label className="flex items-start gap-3 bg-surface-highest/40 backdrop-blur-xl rounded-xl p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => {
              setSmsConsent(e.target.checked)
              setError(null)
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-secondary cursor-pointer"
          />
          <span className="text-on-surface-variant text-sm leading-relaxed">
            By checking this box, I consent to receive non-marketing text messages from Top of the
            Hill Estates, LLC about wifi instructions, rental inquiry, application status,
            scheduling and account-related updates. Message frequency varies, message &amp; data
            rates may apply. Text HELP for assistance, reply STOP to opt out.{' '}
            <a
              href="/privacypolicy"
              className="underline hover:text-secondary transition-colors duration-150"
            >
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
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-secondary cursor-pointer"
          />
          <span className="text-on-surface-variant text-sm leading-relaxed">
            By checking this box, I consent to receive marketing and promotional messages including
            special offers, discounts, new product updates among others from Top of the Hill
            Estates, LLC at the phone number provided. Frequency may vary. Message &amp; data rates
            may apply. Text HELP for assistance, reply STOP to opt out.{' '}
            <a
              href="/privacypolicy"
              className="underline hover:text-secondary transition-colors duration-150"
            >
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
        <p className="text-error text-sm rounded-xl bg-error-container/30 px-4 py-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gradient-to-r from-primary to-secondary text-background font-display font-semibold py-3 rounded-2xl shadow-[0_0_10px_rgba(45,212,191,0.30)] hover:opacity-90 transition-opacity duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {isSubmitting ? 'Submitting…' : 'Submit Inquiry'}
      </button>
    </form>
  )
}
