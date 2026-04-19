'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import DatePicker from './DatePicker'

type Mode = 'reference' | 'email_date'

const inputClass =
  'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50'

export default function BookingLookupForm({ error }: { error: string | null }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('reference')
  const [emailDate, setEmailDate] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [dateError, setDateError] = useState('')

  function handleEmailDateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setDateError('')
    if (!checkIn) {
      setDateError('Please select a check-in date.')
      return
    }
    const params = new URLSearchParams({ guest_email: emailDate, check_in: checkIn })
    router.push(`/booking/manage?${params.toString()}`)
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-surface-container rounded-2xl p-8 shadow-[0_8px_40px_rgba(45,212,191,0.06)]">
        <h1 className="font-display text-3xl font-bold text-primary mb-2">Manage Your Booking</h1>
        <p className="text-on-surface-variant font-body mb-6 text-sm">
          Look up your booking using your confirmation reference or your email and check-in date.
        </p>

        {/* Tab toggle */}
        <div className="flex gap-1 p-1 bg-surface-highest/40 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => setMode('reference')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === 'reference'
                ? 'bg-secondary/20 text-secondary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            By Reference
          </button>
          <button
            type="button"
            onClick={() => setMode('email_date')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === 'email_date'
                ? 'bg-secondary/20 text-secondary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            By Email &amp; Date
          </button>
        </div>

        {error && <p className="text-error text-sm mb-4 font-body">{error}</p>}

        {mode === 'reference' ? (
          <form method="GET" action="/booking/manage" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
                Booking Reference
              </label>
              <input
                name="booking_id"
                type="text"
                required
                placeholder="e.g. A1B2C3D4"
                className={`${inputClass} font-mono uppercase`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
                Email Address
              </label>
              <input
                name="guest_email"
                type="email"
                required
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold font-body hover:opacity-90 transition-opacity"
            >
              Find My Booking
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailDateSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={emailDate}
                onChange={(e) => setEmailDate(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
                Check-in Date
              </label>
              <div className="bg-surface-highest/40 rounded-xl px-4 py-3">
                <DatePicker
                  label=""
                  value={checkIn}
                  onChange={(d) => { setCheckIn(d); setDateError('') }}
                  placeholder="Select your check-in date"
                />
              </div>
              {dateError && <p className="text-error text-xs mt-1">{dateError}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold font-body hover:opacity-90 transition-opacity"
            >
              Find My Booking
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
