'use client'

import { useState } from 'react'

interface FormState {
  name: string
  email: string
  phone: string
  message: string
  smsConsent: boolean
  marketingConsent: boolean
}

const INITIAL_STATE: FormState = {
  name: '',
  email: '',
  phone: '',
  message: '',
  smsConsent: false,
  marketingConsent: false,
}

export default function ContactForm() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target
    const next = type === 'checkbox'
      ? (e.target as HTMLInputElement).checked
      : name === 'phone'
        ? value.replace(/[^\d\s\+\-\(\)\.]/g, '')
        : value
    setForm((prev) => ({ ...prev, [name]: next }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!form.smsConsent) {
      setErrorMessage('You must consent to non-marketing SMS messages to continue.')
      return
    }

    setStatus('sending')
    try {
      // TODO: replace with real API route or GHL webhook
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setStatus('sent')
    } catch {
      setStatus('error')
      setErrorMessage('Something went wrong. Please try again or email us directly.')
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-2xl bg-surface-container p-8 text-center shadow-[0_8px_40px_rgba(45,212,191,0.06)]">
        <p className="font-display text-xl font-semibold text-primary mb-2">Message Sent!</p>
        <p className="font-body text-on-surface-variant">
          Thanks for reaching out. We&apos;ll get back to you as soon as possible.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-surface-container p-8 shadow-[0_8px_40px_rgba(45,212,191,0.06)] space-y-5"
    >
      <div>
        <label htmlFor="name" className="block font-body text-sm text-on-surface-variant mb-1.5">
          Your Name <span className="text-error">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={form.name}
          onChange={handleChange}
          placeholder="Jane Smith"
          className="w-full rounded-xl bg-surface px-4 py-3 font-body text-on-surface placeholder-on-surface-variant/50 outline-none focus:ring-2 focus:ring-secondary/40 transition"
        />
      </div>

      <div>
        <label htmlFor="email" className="block font-body text-sm text-on-surface-variant mb-1.5">
          Email Address <span className="text-error">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={form.email}
          onChange={handleChange}
          placeholder="jane@example.com"
          className="w-full rounded-xl bg-surface px-4 py-3 font-body text-on-surface placeholder-on-surface-variant/50 outline-none focus:ring-2 focus:ring-secondary/40 transition"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block font-body text-sm text-on-surface-variant mb-1.5">
          Phone Number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={form.phone}
          onChange={handleChange}
          placeholder="(480) 555-0000"
          className="w-full rounded-xl bg-surface px-4 py-3 font-body text-on-surface placeholder-on-surface-variant/50 outline-none focus:ring-2 focus:ring-secondary/40 transition"
        />
      </div>

      <div>
        <label
          htmlFor="message"
          className="block font-body text-sm text-on-surface-variant mb-1.5"
        >
          Message <span className="text-error">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          value={form.message}
          onChange={handleChange}
          placeholder="How can we help you?"
          className="w-full rounded-xl bg-surface px-4 py-3 font-body text-on-surface placeholder-on-surface-variant/50 outline-none focus:ring-2 focus:ring-secondary/40 transition resize-none"
        />
      </div>

      <div className="space-y-3 pt-1">
        <label className="flex items-start gap-3 bg-surface px-4 py-4 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            name="smsConsent"
            checked={form.smsConsent}
            onChange={handleChange}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-secondary cursor-pointer"
          />
          <span className="font-body text-sm text-on-surface-variant leading-relaxed">
            By checking this box, I consent to receive non-marketing text messages from Top of
            the Hill Estates, LLC about wifi instructions, rental inquiry, application status,
            scheduling and account-related updates. Message frequency varies, message &amp; data
            rates may apply. Carriers are not liable for delayed or undelivered messages. Text HELP for assistance, reply STOP to opt out. Consent is not required as a condition of purchase.{' '}
            <a href="/privacypolicy" className="underline hover:text-secondary transition-colors duration-150">
              Privacy Policy
            </a>{' '}
            and{' '}
            <a href="/termsandconditions" className="underline hover:text-secondary transition-colors duration-150">
              Terms of Service
            </a>
          </span>
        </label>

        <label className="flex items-start gap-3 bg-surface px-4 py-4 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            name="marketingConsent"
            checked={form.marketingConsent}
            onChange={handleChange}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-secondary cursor-pointer"
          />
          <span className="font-body text-sm text-on-surface-variant leading-relaxed">
            By checking this box, I consent to receive marketing and promotional messages
            including special offers, discounts, new product updates among others from Top of
            the Hill Estates, LLC at the phone number provided. Frequency may vary. Message
            &amp; data rates may apply. Carriers are not liable for delayed or undelivered messages. Text HELP for assistance, reply STOP to opt out.{' '}
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

      {status === 'error' && errorMessage && (
        <p className="font-body text-sm text-error">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold font-body hover:opacity-90 disabled:opacity-60 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {status === 'sending' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  )
}
