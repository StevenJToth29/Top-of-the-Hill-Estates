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
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMessage(null)
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
      <div className="rounded-2xl bg-surface-container p-8 text-center shadow-[0_8px_40px_rgba(175,201,234,0.06)]">
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
      className="rounded-2xl bg-surface-container p-8 shadow-[0_8px_40px_rgba(175,201,234,0.06)] space-y-5"
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
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="smsConsent"
            checked={form.smsConsent}
            onChange={handleChange}
            className="mt-1 h-4 w-4 shrink-0 rounded accent-secondary"
          />
          <span className="font-body text-sm text-on-surface-variant leading-relaxed">
            I agree to receive text messages from Top of the Hill Estates, LLC regarding my
            inquiry and reservation updates. Message and data rates may apply. Reply STOP to
            opt out at any time.
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="marketingConsent"
            checked={form.marketingConsent}
            onChange={handleChange}
            className="mt-1 h-4 w-4 shrink-0 rounded accent-secondary"
          />
          <span className="font-body text-sm text-on-surface-variant leading-relaxed">
            I also agree to receive promotional messages about special offers and availability
            from Top of the Hill Estates, LLC. (Optional)
          </span>
        </label>
      </div>

      {status === 'error' && errorMessage && (
        <p className="font-body text-sm text-error">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold font-body disabled:opacity-60 transition"
      >
        {status === 'sending' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  )
}
