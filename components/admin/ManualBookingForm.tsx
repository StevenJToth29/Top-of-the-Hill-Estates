'use client'

import { useState, useEffect } from 'react'
import { differenceInCalendarDays, parseISO, format } from 'date-fns'
import type { Room, BookingType } from '@/types'
import { createClient } from '@/lib/supabase-browser'
import { formatCurrency, OPEN_ENDED_DATE } from '@/lib/format'
import DatePicker from '@/components/public/DatePicker'

const today = format(new Date(), 'yyyy-MM-dd')

type Props = {
  onSuccess: () => void
  onCancel: () => void
}

export default function ManualBookingForm({ onSuccess, onCancel }: Props) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loadingRooms, setLoadingRooms] = useState(true)

  const [roomId, setRoomId] = useState('')
  const [bookingType, setBookingType] = useState<BookingType>('short_term')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [noEndDate, setNoEndDate] = useState(false)
  const [guests, setGuests] = useState(1)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setRooms((data as Room[]) ?? [])
        setLoadingRooms(false)
      })
  }, [])

  const selectedRoom = rooms.find((r) => r.id === roomId)

  const nights =
    checkIn && checkOut
      ? Math.max(0, differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)))
      : 0

  const rate =
    bookingType === 'long_term'
      ? (selectedRoom?.monthly_rate ?? 0)
      : (selectedRoom?.nightly_rate ?? 0)

  const totalAmount = bookingType === 'long_term' ? rate : rate * nights

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const requiresCheckOut = !(bookingType === 'long_term' && noEndDate)
    if (!roomId || !checkIn || (requiresCheckOut && !checkOut) || !firstName || !lastName || !email || !phone) {
      setError('Please fill in all required fields.')
      return
    }
    if (requiresCheckOut && nights < 1) {
      setError('Check-out must be after check-in.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/bookings/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          booking_type: bookingType,
          guest_first_name: firstName,
          guest_last_name: lastName,
          guest_email: email,
          guest_phone: phone,
          sms_consent: smsConsent,
          marketing_consent: marketingConsent,
          check_in: checkIn,
          check_out: bookingType === 'long_term' && noEndDate ? OPEN_ENDED_DATE : checkOut,
          guests,
          total_nights: nights,
          nightly_rate: selectedRoom?.nightly_rate ?? 0,
          monthly_rate: selectedRoom?.monthly_rate ?? 0,
          total_amount: totalAmount,
          amount_paid: 0,
          amount_due_at_checkin: 0,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`)
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <label className="text-xs text-on-surface-variant">
          Unit <span className="text-error">*</span>
        </label>
        {loadingRooms ? (
          <p className="text-sm text-on-surface-variant">Loading units…</p>
        ) : (
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            required
            className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 outline-none"
          >
            <option value="">Select a unit…</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {formatCurrency(r.nightly_rate)}/night / {formatCurrency(r.monthly_rate)}/mo
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs text-on-surface-variant">Booking Type</label>
        <div className="flex gap-2">
          {(['short_term', 'long_term'] as BookingType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setBookingType(t); if (t !== 'long_term') setNoEndDate(false) }}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                bookingType === t
                  ? 'bg-secondary/20 text-secondary'
                  : 'bg-surface-highest/40 text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t === 'short_term' ? 'Short-term' : 'Long-term'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-on-surface-variant">
            First Name <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-on-surface-variant">
            Last Name <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 outline-none"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-on-surface-variant">
          Email <span className="text-error">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-on-surface-variant">
          Phone <span className="text-error">*</span>
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d\s\+\-\(\)\.]/g, ''))}
          required
          className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            className="mt-0.5 rounded"
          />
          <span className="text-sm text-on-surface-variant">
            Guest consents to receive SMS communications (A2P)
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-0.5 rounded"
          />
          <span className="text-sm text-on-surface-variant">
            Guest consents to marketing communications
          </span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-highest/40 rounded-xl px-4 py-3">
          <DatePicker
            label="Check-in"
            value={checkIn}
            onChange={(d) => { setCheckIn(d); if (checkOut && checkOut <= d) setCheckOut('') }}
            min={today}
            placeholder="Select date"
          />
        </div>
        <div className="bg-surface-highest/40 rounded-xl px-4 py-3">
          {bookingType === 'long_term' && noEndDate ? (
            <div>
              <p className="text-xs text-on-surface-variant mb-1">Check-out</p>
              <p className="text-sm text-on-surface-variant italic">Open-ended</p>
            </div>
          ) : (
            <DatePicker
              label="Check-out"
              value={checkOut}
              onChange={setCheckOut}
              min={checkIn || today}
              placeholder="Select date"
            />
          )}
        </div>
      </div>

      {bookingType === 'long_term' && (
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={noEndDate}
            onChange={(e) => { setNoEndDate(e.target.checked); if (e.target.checked) setCheckOut('') }}
            className="mt-0.5 rounded"
          />
          <span className="text-sm text-on-surface-variant">No end date (open-ended tenancy)</span>
        </label>
      )}

      <div className="space-y-1">
        <label className="text-xs text-on-surface-variant">Number of Guests</label>
        <input
          type="number"
          min={1}
          max={selectedRoom?.guest_capacity ?? 10}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 outline-none"
        />
      </div>

      {selectedRoom && (nights > 0 || (bookingType === 'long_term' && noEndDate)) && (
        <div className="rounded-xl bg-surface-highest/40 p-4 space-y-2">
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Price Summary
          </h3>
          {bookingType === 'short_term' ? (
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">
                {formatCurrency(rate)} × {nights} night{nights !== 1 ? 's' : ''}
              </span>
              <span className="text-on-surface">{formatCurrency(totalAmount)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Monthly rate (deposit)</span>
              <span className="text-on-surface">{formatCurrency(rate)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold pt-1">
            <span className="text-on-surface-variant">Total</span>
            <span className="text-on-surface">{formatCurrency(totalAmount)}</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Manual booking — amount paid will be $0.00 (cash/in-person payment).
          </p>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl bg-secondary/20 px-4 py-3 text-sm font-semibold text-secondary hover:bg-secondary/30 transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create Booking'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl px-4 py-3 text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-highest/40 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
