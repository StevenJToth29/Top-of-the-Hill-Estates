'use client'

import { useState, useEffect } from 'react'
import { differenceInDays } from 'date-fns'
import { ModalShell } from './ModalShell'
import DatePicker from '@/components/public/DatePicker'
import { OPEN_ENDED_DATE, formatCurrency } from '@/lib/format'
import type { Room, BookingType } from '@/types'

const SOURCES = ['direct', 'airbnb', 'vrbo', 'booking.com', 'other'] as const

interface AddBookingModalProps {
  rooms: Room[]
  initialRoomId: string
  initialCheckIn: string
  initialCheckOut: string
  onClose: () => void
  onSuccess: () => void
}

export function AddBookingModal({
  rooms,
  initialRoomId,
  initialCheckIn,
  initialCheckOut,
  onClose,
  onSuccess,
}: AddBookingModalProps) {
  const [roomId, setRoomId] = useState(initialRoomId)
  const [bookingType, setBookingType] = useState<BookingType>('short_term')
  const [checkIn, setCheckIn] = useState(initialCheckIn)
  const [checkOut, setCheckOut] = useState(initialCheckOut)
  const [guests, setGuests] = useState('1')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState<string>('direct')
  const [notes, setNotes] = useState('')
  const [noEndDate, setNoEndDate] = useState(false)
  const [monthlyAmount, setMonthlyAmount] = useState(0)
  const [smsConsent, setSmsConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const room = rooms.find((r) => r.id === roomId)

  useEffect(() => {
    if (bookingType === 'long_term') {
      setMonthlyAmount(room?.monthly_rate ?? 0)
    }
  }, [roomId, bookingType, room?.monthly_rate])

  const nights = checkIn && checkOut
    ? Math.max(0, differenceInDays(new Date(checkOut + 'T00:00:00'), new Date(checkIn + 'T00:00:00')))
    : 0
  const suggestedTotal = room ? nights * room.nightly_rate : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (bookingType === 'long_term' && monthlyAmount <= 0) {
      setError('Monthly amount must be greater than $0.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/bookings/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          booking_type: bookingType,
          check_in: checkIn,
          check_out: bookingType === 'long_term' && noEndDate ? OPEN_ENDED_DATE : checkOut,
          guest_first_name: firstName,
          guest_last_name: lastName,
          guest_email: email,
          guest_phone: phone,
          guest_count: parseInt(guests) || 1,
          source,
          notes,
          sms_consent: smsConsent,
          marketing_consent: marketingConsent,
          ...(bookingType === 'long_term' ? { admin_monthly_amount: monthlyAmount } : {}),
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to create booking')
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Add Booking" onClose={onClose} width="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Room</label>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
              {(['short_term', 'long_term'] as BookingType[]).map((t) => (
                <button key={t} type="button" onClick={() => setBookingType(t)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    bookingType === t ? 'text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                  style={bookingType === t ? { background: '#2DD4BF' } : {}}>
                  {t === 'short_term' ? 'Short-term' : 'Long-term'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <DatePicker
              label="Check-in"
              value={checkIn}
              onChange={setCheckIn}
              max={checkOut || undefined}
              placeholder="Select date"
            />
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            {bookingType === 'long_term' && noEndDate ? (
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">Check-out</p>
                <p className="text-sm text-slate-400 italic">Open-ended</p>
              </div>
            ) : (
              <DatePicker
                label="Check-out"
                value={checkOut}
                onChange={setCheckOut}
                min={checkIn || undefined}
                placeholder="Select date"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Guests</label>
            <input type="number" value={guests} onChange={(e) => setGuests(e.target.value)}
              min={1} max={20}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
        </div>

        {bookingType === 'long_term' && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Monthly Amount <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" value={monthlyAmount} onChange={(e) => setMonthlyAmount(Number(e.target.value))}
                  min={0.01} step={0.01}
                  className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={noEndDate}
                onChange={(e) => { setNoEndDate(e.target.checked); if (e.target.checked) setCheckOut('') }}
                className="accent-teal-500" />
              No end date (open-ended tenancy)
            </label>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">First Name</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)}
              className="accent-teal-500" />
            SMS consent
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)}
              className="accent-teal-500" />
            Marketing consent
          </label>
        </div>

        {room && (nights > 0 || (bookingType === 'long_term' && noEndDate)) && (
          <div className="rounded-xl bg-teal-50 border border-teal-100 px-4 py-3 text-sm">
            {bookingType === 'long_term' ? (
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Monthly Amount</span>
                <span>{formatCurrency(monthlyAmount)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>{formatCurrency(room.nightly_rate)} × {nights} nights</span>
                  <span>{formatCurrency(suggestedTotal)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-800 mt-1">
                  <span>Suggested Total</span>
                  <span>{formatCurrency(suggestedTotal)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: '#2DD4BF' }}>
            {saving ? 'Creating…' : 'Create Booking'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
