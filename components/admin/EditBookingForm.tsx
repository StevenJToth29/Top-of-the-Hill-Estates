'use client'

import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { Booking, Room, Property } from '@/types'
import { OPEN_ENDED_DATE, formatCurrency } from '@/lib/format'

interface Props {
  booking: Booking & { room: Room & { property: Property } }
  onClose: () => void
  onSaved: (updated: Booking) => void
}

function computeShortTermTotal(
  checkIn: string,
  checkOut: string,
  nightlyRate: number,
  cleaningFee: number,
  extraGuestFee: number,
  extraGuests: number,
): number {
  const [ciY, ciM, ciD] = checkIn.split('-').map(Number)
  const [coY, coM, coD] = checkOut.split('-').map(Number)
  const start = new Date(Date.UTC(ciY, ciM - 1, ciD))
  const end = new Date(Date.UTC(coY, coM - 1, coD))
  let nights = 0
  const cur = new Date(start)
  while (cur < end) {
    nights++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return nightlyRate * nights + cleaningFee + extraGuestFee * extraGuests * nights
}

function computeLongTermTotal(
  monthlyRate: number,
  securityDeposit: number,
  extraGuestFee: number,
  extraGuests: number,
): number {
  return monthlyRate + securityDeposit + extraGuestFee * extraGuests
}

export default function EditBookingForm({ booking, onClose, onSaved }: Props) {
  const [checkIn, setCheckIn] = useState(booking.check_in)
  const [checkOut, setCheckOut] = useState(
    booking.check_out === OPEN_ENDED_DATE ? '' : booking.check_out,
  )
  const [openEnded, setOpenEnded] = useState(booking.check_out === OPEN_ENDED_DATE)
  const [firstName, setFirstName] = useState(booking.guest_first_name)
  const [lastName, setLastName] = useState(booking.guest_last_name)
  const [email, setEmail] = useState(booking.guest_email)
  const [phone, setPhone] = useState(booking.guest_phone)
  const [guestCount, setGuestCount] = useState(booking.guest_count)
  const [notes, setNotes] = useState(booking.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const room = booking.room
  const isLongTerm = booking.booking_type === 'long_term'

  const newTotal = (() => {
    const extraGuests = Math.max(0, guestCount - 1)
    if (isLongTerm) {
      return computeLongTermTotal(
        room.monthly_rate,
        room.security_deposit ?? 0,
        room.extra_guest_fee ?? 0,
        extraGuests,
      )
    }
    if (!checkOut || checkOut === OPEN_ENDED_DATE) return booking.total_amount
    return computeShortTermTotal(
      checkIn,
      checkOut,
      room.nightly_rate,
      room.cleaning_fee ?? 0,
      room.extra_guest_fee ?? 0,
      extraGuests,
    )
  })()

  const delta = newTotal - booking.amount_paid
  const hasStripe = !!booking.stripe_payment_intent_id

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_in: checkIn,
          check_out: openEnded ? OPEN_ENDED_DATE : checkOut,
          guest_first_name: firstName,
          guest_last_name: lastName,
          guest_email: email,
          guest_phone: phone,
          guest_count: guestCount,
          notes: notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save changes')
        return
      }
      onSaved(data.booking)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/60 to-white shrink-0">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">Edit Booking</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              #{booking.id.slice(0, 8).toUpperCase()} · {firstName} {lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          <form id="edit-booking-form" onSubmit={handleSubmit}>

            {/* Stay Dates */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Stay Dates</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Check-in</label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Check-out</label>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    disabled={openEnded}
                    required={!openEnded}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {isLongTerm && (
                <label className="flex items-center gap-2.5 mt-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openEnded}
                    onChange={(e) => {
                      setOpenEnded(e.target.checked)
                      if (e.target.checked) setCheckOut('')
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-slate-600 focus:ring-teal-400"
                  />
                  <span className="text-xs text-slate-600">No end date (open-ended tenancy)</span>
                </label>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* Guest */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Guest</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Guests</label>
                  <input
                    type="number"
                    min={1}
                    value={guestCount}
                    onChange={(e) => setGuestCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                    placeholder="Admin notes…"
                  />
                </div>
              </div>
            </div>

            {/* Payment adjustment preview */}
            {Math.abs(newTotal - booking.total_amount) >= 0.01 && (
              <>
                <hr className="border-slate-100" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Payment Adjustment</p>
                  <div
                    className="rounded-xl p-3 text-sm space-y-1.5"
                    style={{
                      background: delta > 0 ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.07)',
                      border: `1px solid ${delta > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.2)'}`,
                    }}
                  >
                    <div className="flex justify-between text-slate-500">
                      <span>Original total</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(booking.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>New total</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(newTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Already paid</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(booking.amount_paid)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 mt-1 border-t border-black/10">
                      <span className="font-bold text-slate-700">{delta > 0 ? 'Additional charge' : 'Refund'}</span>
                      <span
                        className="font-bold"
                        style={{ color: delta > 0 ? '#b45309' : '#059669' }}
                      >
                        {delta > 0 ? '+' : '−'}{formatCurrency(Math.abs(delta))}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                      {delta > 0
                        ? hasStripe
                          ? `A payment request for ${formatCurrency(delta)} will be emailed to ${email} automatically on save.`
                          : `Balance updated on record. No Stripe payment to process (manual booking).`
                        : hasStripe
                        ? `A Stripe refund of ${formatCurrency(Math.abs(delta))} will be issued automatically on save.`
                        : `Balance updated on record. No Stripe refund to process (manual booking).`}
                    </p>
                  </div>
                </div>
              </>
            )}

          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex justify-between items-center shrink-0">
          {error && <p className="text-xs text-red-500 mr-3">{error}</p>}
          {!error && <span />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-booking-form"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-teal-400 text-slate-900 hover:bg-teal-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
