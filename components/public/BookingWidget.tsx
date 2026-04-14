'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, differenceInDays, parseISO, addDays } from 'date-fns'
import type { Room, BookingType } from '@/types'
import DatePicker from './DatePicker'

interface Props {
  room: Room
  blockedDates: string[]
}

function formatDate(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

const today = formatDate(new Date())

function isRangeBlocked(checkIn: string, checkOut: string, blocked: Set<string>): boolean {
  const start = parseISO(checkIn)
  const days = differenceInDays(parseISO(checkOut), start)
  for (let i = 0; i < days; i++) {
    if (blocked.has(formatDate(addDays(start, i)))) return true
  }
  return false
}

const pillBase = 'flex-1 py-2 text-sm font-medium rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
const pillActive = 'bg-secondary/20 text-secondary border border-secondary/50'
const pillInactive = 'bg-surface-container text-on-surface-variant hover:text-on-surface'

export default function BookingWidget({ room, blockedDates }: Props) {
  const router = useRouter()
  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates])

  const [bookingType, setBookingType] = useState<BookingType>('short_term')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [moveIn, setMoveIn] = useState('')
  const [guests, setGuests] = useState(1)
  const [error, setError] = useState('')

  const nights = checkIn && checkOut ? differenceInDays(parseISO(checkOut), parseISO(checkIn)) : 0
  const subtotal = nights * room.nightly_rate

  const validate = useCallback((): boolean => {
    setError('')
    if (bookingType === 'short_term') {
      if (!checkIn || !checkOut) { setError('Please select check-in and check-out dates.'); return false }
      if (nights <= 0) { setError('Check-out must be after check-in.'); return false }
      if (nights < room.minimum_nights_short_term) {
        setError(`Minimum stay is ${room.minimum_nights_short_term} night${room.minimum_nights_short_term !== 1 ? 's' : ''}.`)
        return false
      }
      if (blockedSet.has(checkIn) || isRangeBlocked(checkIn, checkOut, blockedSet)) {
        setError('One or more selected dates are unavailable.')
        return false
      }
    } else {
      if (!moveIn) { setError('Please select a move-in date.'); return false }
      if (blockedSet.has(moveIn)) { setError('Selected move-in date is unavailable.'); return false }
    }
    return true
  }, [bookingType, checkIn, checkOut, moveIn, nights, room, blockedSet])

  const handleBook = useCallback(() => {
    if (!validate()) return

    const params = new URLSearchParams({
      room_id: room.id,
      room: room.slug,
      type: bookingType,
      guests: String(guests),
      nightly_rate: String(room.nightly_rate),
      monthly_rate: String(room.monthly_rate),
    })

    if (bookingType === 'short_term') {
      params.set('checkin', checkIn)
      params.set('checkout', checkOut)
      params.set('total_nights', String(nights))
      params.set('total_amount', String(subtotal))
      params.set('amount_to_pay', String(subtotal))
      params.set('amount_due', '0')
    } else {
      params.set('checkin', moveIn)
      params.set('checkout', '')
      params.set('total_nights', '30')
      params.set('total_amount', String(room.monthly_rate * 2))
      params.set('amount_to_pay', String(room.monthly_rate))
      params.set('amount_due', String(room.monthly_rate))
    }

    router.push(`/checkout?${params.toString()}`)
  }, [validate, room, bookingType, guests, checkIn, checkOut, moveIn, nights, subtotal, router])

  const guestOptions = Array.from({ length: Math.min(room.guest_capacity, 2) }, (_, i) => i + 1)

  const GuestSelector = (
    <div>
      <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2">
        Guests
      </label>
      <div className="flex gap-2">
        {guestOptions.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setGuests(n)}
            className={[
              'flex-1 py-2 rounded-xl text-sm font-medium transition-colors',
              guests === n
                ? 'bg-primary text-white'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-high hover:text-on-surface',
            ].join(' ')}
          >
            {n} {n === 1 ? 'Guest' : 'Guests'}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-5 space-y-5 sticky top-6">
      <div className="flex gap-2 p-1 bg-surface-container rounded-2xl">
        <button
          className={`${pillBase} ${bookingType === 'short_term' ? pillActive : pillInactive}`}
          onClick={() => { setBookingType('short_term'); setError('') }}
        >
          Short-term (Nightly)
        </button>
        <button
          className={`${pillBase} ${bookingType === 'long_term' ? pillActive : pillInactive}`}
          onClick={() => { setBookingType('long_term'); setError('') }}
        >
          Long-term (Monthly)
        </button>
      </div>

      {bookingType === 'short_term' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-highest/40 rounded-xl px-3 py-2.5">
              <DatePicker
                label="Check-in"
                value={checkIn}
                onChange={(d) => { setCheckIn(d); setCheckOut(''); setError('') }}
                min={today}
                placeholder="Add date"
              />
            </div>
            <div className="bg-surface-highest/40 rounded-xl px-3 py-2.5">
              <DatePicker
                label="Check-out"
                value={checkOut}
                onChange={(d) => { setCheckOut(d); setError('') }}
                min={checkIn ? format(addDays(parseISO(checkIn), room.minimum_nights_short_term), 'yyyy-MM-dd') : today}
                placeholder="Add date"
              />
            </div>
          </div>

          {GuestSelector}

          {nights > 0 && (
            <div className="bg-surface-container rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>{nights} night{nights !== 1 ? 's' : ''} × ${room.nightly_rate.toLocaleString()}</span>
                <span>${subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-outline-variant">
                <span className="text-on-surface font-medium">Due today</span>
                <span className="text-primary font-bold text-lg">${subtotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          <p className="text-xs text-on-surface-variant">
            Min. {room.minimum_nights_short_term} night{room.minimum_nights_short_term !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {bookingType === 'long_term' && (
        <div className="space-y-3">
          <div className="bg-surface-highest/40 rounded-xl px-3 py-2.5">
            <DatePicker
              label="Move-in Date"
              value={moveIn}
              onChange={(d) => { setMoveIn(d); setError('') }}
              min={today}
              placeholder="Add date"
            />
          </div>

          {GuestSelector}

          <div className="bg-surface-container rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-on-surface-variant">
              <span>Monthly rate</span>
              <span>${room.monthly_rate.toLocaleString()}/month</span>
            </div>
            <div className="flex justify-between text-on-surface-variant">
              <span>Deposit at booking</span>
              <span>${room.monthly_rate.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-on-surface-variant">
              <span>Balance due at check-in</span>
              <span>${room.monthly_rate.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-outline-variant">
              <span className="text-on-surface font-medium">Due today</span>
              <span className="text-primary font-bold text-2xl">${room.monthly_rate.toLocaleString()}</span>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant">
            Min. {room.minimum_nights_long_term} days. Deposit is non-refundable.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-error bg-error-container/30 rounded-xl px-4 py-2">{error}</p>
      )}

      <button
        onClick={handleBook}
        className="w-full bg-gradient-to-r from-primary to-secondary text-background font-display font-semibold py-3 rounded-2xl shadow-[0_0_10px_rgba(45,212,191,0.30)] hover:opacity-90 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Book Now
      </button>
    </div>
  )
}
