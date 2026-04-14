'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FormState {
  firstName: string
  lastName: string
  email: string
  phone: string
  message: string
  smsConsent: boolean
  marketingConsent: boolean
}

const initialState: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  message: '',
  smsConsent: false,
  marketingConsent: false,
}

interface ConsentCheckboxProps {
  id: keyof FormState
  checked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
  badge: React.ReactNode
  children: React.ReactNode
}

function ConsentCheckbox({ id, checked, onChange, required, badge, children }: ConsentCheckboxProps) {
  return (
    <div className="bg-surface-highest/40 backdrop-blur-xl rounded-xl p-4 flex gap-3">
      <input
        id={id}
        name={id}
        type="checkbox"
        required={required}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 shrink-0 accent-secondary cursor-pointer"
      />
      <label htmlFor={id} className="text-xs text-on-surface-variant leading-relaxed cursor-pointer">
        {children}{' '}
        <Link href="/privacypolicy" className="text-secondary hover:underline">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href="/termsandconditions" className="text-secondary hover:underline">
          Terms of Service
        </Link>
        .{' '}
        {badge}
      </label>
    </div>
  )
}

export default function ContactForm() {
  const [form, setForm] = useState<FormState>(initialState)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Request failed')
      setStatus('success')
      setForm(initialState)
    } catch {
      setStatus('error')
    }
  }

  const inputClass =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm text-on-surface-variant mb-1">
            First Name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            value={form.firstName}
            onChange={handleChange}
            placeholder="Jane"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm text-on-surface-variant mb-1">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            value={form.lastName}
            onChange={handleChange}
            placeholder="Doe"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm text-on-surface-variant mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={form.email}
          onChange={handleChange}
          placeholder="jane@example.com"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm text-on-surface-variant mb-1">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={form.phone}
          onChange={handleChange}
          placeholder="(480) 555-0000"
          className={inputClass}
        />
      </div>

      <ConsentCheckbox
        id="smsConsent"
        checked={form.smsConsent}
        onChange={handleChange}
        required
        badge={<span className="text-error">(required)</span>}
      >
        By checking this box, I consent to receive non-marketing text messages from Top of the Hill
        Estates, LLC about wifi instructions, rental inquiry, application status, scheduling and
        account-related updates. Message frequency varies, message &amp; data rates may apply. Text
        HELP for assistance, reply STOP to opt out. See our
      </ConsentCheckbox>

      <ConsentCheckbox
        id="marketingConsent"
        checked={form.marketingConsent}
        onChange={handleChange}
        badge={<span className="text-on-surface-variant/60">(optional)</span>}
      >
        By checking this box, I consent to receive marketing and promotional messages including
        special offers, discounts, new product updates among others from Top of the Hill Estates,
        LLC at the phone number provided. Frequency may vary. Message &amp; data rates may apply.
        Text HELP for assistance, reply STOP to opt out. See our
      </ConsentCheckbox>

      <div>
        <label htmlFor="message" className="block text-sm text-on-surface-variant mb-1">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          value={form.message}
          onChange={handleChange}
          placeholder="Tell us about your needs..."
          className={`${inputClass} resize-none`}
        />
      </div>

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-8 py-3 shadow-[0_0_10px_rgba(175,201,234,0.30)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? 'Sending…' : 'Send Message'}
      </button>

      {status === 'success' && (
        <p className="text-center text-sm text-secondary">
          Message sent! We&apos;ll be in touch shortly.
        </p>
      )}
      {status === 'error' && (
        <p className="text-center text-sm text-error">
          Something went wrong. Please try again or email us directly.
        </p>
      )}
    </form>
  )
}
