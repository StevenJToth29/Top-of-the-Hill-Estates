'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, differenceInDays, parseISO, addDays, startOfDay } from 'date-fns'
import type { Room, BookingType, RoomFee } from '@/types'
import DatePicker from './DatePicker'
import DateRangePicker from './DateRangePicker'
import { buildAirbnbUrl } from '@/lib/airbnb'

interface Props {
  room: Room
  blockedDates: string[]
  dateOverrides?: Record<string, number>
  initialCheckin?: string
  initialCheckout?: string
  initialGuests?: number
  stripeFeePercent?: number
  stripeFeeFlat?: number
  minMoveIn?: string
}

function formatDate(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

function isRangeBlocked(checkIn: string, checkOut: string, blocked: Set<string>): boolean {
  const start = parseISO(checkIn)
  const days = differenceInDays(parseISO(checkOut), start)
  for (let i = 0; i < days; i++) {
    if (blocked.has(formatDate(addDays(start, i)))) return true
  }
  return false
}

function AirbnbLogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.263-1.027-.16-1.848.291-2.465.477-.71 1.188-1.056 2.121-1.056s1.643.345 2.12 1.063c.446.61.558 1.432.286 2.465-.291 1.298-1.085 2.785-2.412 4.458zm9.601 1.14c-.185 1.246-1.034 2.28-2.2 2.783-2.253.98-4.483-.583-6.392-2.704 3.157-3.951 3.74-7.028 2.385-9.018-.795-1.14-1.933-1.695-3.394-1.695-2.944 0-4.563 2.49-3.927 5.382.37 1.565 1.352 3.343 2.917 5.332-.98 1.085-1.91 1.856-2.732 2.333-.636.344-1.245.558-1.828.609-2.679.399-4.778-2.2-3.825-4.88.132-.345.395-.98.845-1.961l.025-.053c1.464-3.178 3.242-6.79 5.285-10.795l.053-.132.58-1.116c.45-.822.635-1.19 1.351-1.643.346-.21.77-.315 1.246-.315.954 0 1.698.558 2.016 1.007.158.239.345.557.582.953l.558 1.089.08.159c2.041 4.004 3.821 7.608 5.279 10.794l.026.025.533 1.22.318.764c.243.613.294 1.222.213 1.858zm1.22-2.39c-.186-.583-.505-1.271-.9-2.094v-.03c-1.889-4.006-3.642-7.608-5.307-10.844l-.111-.163C15.317 1.461 14.468 0 12.001 0c-2.44 0-3.476 1.695-4.535 3.898l-.081.16c-1.669 3.236-3.421 6.843-5.303 10.847v.053l-.559 1.22c-.21.504-.317.768-.345.847C-.172 20.74 2.611 24 5.98 24c.027 0 .132 0 .265-.027h.372c1.75-.213 3.554-1.325 5.384-3.317 1.829 1.989 3.635 3.104 5.382 3.317h.372c.133.027.239.027.265.027 3.37.003 6.152-3.261 4.802-6.975z" />
    </svg>
  )
}

const pillBase =
  'flex-1 py-2 text-sm font-medium rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
const pillActive = 'bg-secondary/20 text-secondary border border-secondary/50'
const pillInactive = 'bg-surface-container text-on-surface-variant hover:text-on-surface'

export default function BookingWidget({ room, blockedDates, dateOverrides = {}, initialCheckin, initialCheckout, initialGuests, stripeFeePercent = 2.9, stripeFeeFlat = 0.30, minMoveIn }: Props) {
  const router = useRouter()
  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates])

  const showNightly = room.show_nightly_rate ?? true
  const showMonthly = room.show_monthly_rate ?? true
  const defaultType: BookingType = showNightly ? 'short_term' : 'long_term'
  const [bookingType, setBookingType] = useState<BookingType>(defaultType)
  const [checkIn, setCheckIn] = useState(initialCheckin ?? '')
  const [checkOut, setCheckOut] = useState(initialCheckout ?? '')
  const [moveIn, setMoveIn] = useState(initialCheckin ?? '')
  const [guests, setGuests] = useState(() => {
    const cap = Math.max(room.guest_capacity ?? 1, 1)
    if (initialGuests && initialGuests >= 1 && initialGuests <= cap) return initialGuests
    return 1
  })
  const [error, setError] = useState('')

  const today = useMemo(() => formatDate(new Date()), [])

  const todayDate = useMemo(() => startOfDay(new Date()), [])

  const shortTermWindowEnd = useMemo(() => {
    const applies = room.max_advance_booking_applies_to ?? 'both'
    if (applies === 'long_term') return undefined
    const days = room.max_advance_booking_days
    if (days == null) return undefined
    if (days === 0) return format(addDays(todayDate, -1), 'yyyy-MM-dd')
    return format(addDays(todayDate, days), 'yyyy-MM-dd')
  }, [room.max_advance_booking_days, room.max_advance_booking_applies_to, todayDate])

  const longTermWindowEnd = useMemo(() => {
    const applies = room.max_advance_booking_applies_to ?? 'both'
    if (applies === 'short_term') return undefined
    const days = room.max_advance_booking_days
    if (days == null) return undefined
    if (days === 0) return format(addDays(todayDate, -1), 'yyyy-MM-dd')
    return format(addDays(todayDate, days), 'yyyy-MM-dd')
  }, [room.max_advance_booking_days, room.max_advance_booking_applies_to, todayDate])

  const isShortTermWindowBlocked = shortTermWindowEnd !== undefined && shortTermWindowEnd < today
  const isLongTermWindowBlocked = longTermWindowEnd !== undefined && longTermWindowEnd < today
  const currentTypeBlocked = bookingType === 'short_term' ? isShortTermWindowBlocked : isLongTermWindowBlocked

  // Keep URL in sync with selected dates so the back button can restore them
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (checkIn) params.set('checkin', checkIn); else params.delete('checkin')
    if (checkOut) params.set('checkout', checkOut); else params.delete('checkout')
    params.set('guests', String(guests))
    window.history.replaceState(null, '', `?${params.toString()}`)
  }, [checkIn, checkOut, guests])

  const roomFees: RoomFee[] = useMemo(() => room.fees ?? [], [room.fees])
  const cleaningFee = room.cleaning_fee ?? 0
  const securityDeposit = room.security_deposit ?? 0
  const extraGuestFee = room.extra_guest_fee ?? 0

  // First blocked date strictly after check-in — caps how far out checkout can go
  const checkOutMax = useMemo(() => {
    if (!checkIn) return undefined
    const sorted = [...blockedDates].sort()
    return sorted.find((d) => d > checkIn)
  }, [checkIn, blockedDates])

  const nights = checkIn && checkOut ? differenceInDays(parseISO(checkOut), parseISO(checkIn)) : 0

  const subtotal = useMemo(() => {
    if (nights <= 0 || !checkIn || !checkOut) return 0
    const [ciY, ciM, ciD] = checkIn.split('-').map(Number)
    const start = new Date(Date.UTC(ciY, ciM - 1, ciD))
    let total = 0
    for (let i = 0; i < nights; i++) {
      const d = new Date(start)
      d.setUTCDate(d.getUTCDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      total += dateOverrides[dateStr] ?? room.nightly_rate
    }
    return total
  }, [nights, checkIn, checkOut, dateOverrides, room.nightly_rate])

  const hasRateVariation = nights > 0 && subtotal !== nights * room.nightly_rate

  const extraGuests = Math.max(0, guests - 1)

  // Short-term fee totals
  const stExtraGuestTotal = extraGuests * extraGuestFee * nights
  const stGenericFees = roomFees.filter((f) => f.booking_type === 'short_term' || f.booking_type === 'both')
  const stGenericTotal = stGenericFees.reduce((sum, f) => sum + f.amount, 0)
  const stTotal = subtotal + cleaningFee + stExtraGuestTotal + stGenericTotal
  const stProcessingFee = nights > 0 ? Math.round(((stTotal + stripeFeeFlat) / (1 - stripeFeePercent / 100) - stTotal) * 100) / 100 : 0
  const stGrandTotal = stTotal + stProcessingFee

  // Long-term fee totals
  const ltExtraGuestTotal = extraGuests * extraGuestFee
  const ltGenericFees = roomFees.filter((f) => f.booking_type === 'long_term' || f.booking_type === 'both')
  const ltGenericTotal = ltGenericFees.reduce((sum, f) => sum + f.amount, 0)
  const ltTotal = room.monthly_rate + securityDeposit + ltExtraGuestTotal + ltGenericTotal
  const ltProcessingFee = Math.round(((ltTotal + stripeFeeFlat) / (1 - stripeFeePercent / 100) - ltTotal) * 100) / 100
  const ltGrandTotal = ltTotal + ltProcessingFee

  const validate = useCallback((): boolean => {
    setError('')
    if (bookingType === 'short_term') {
      if (!checkIn || !checkOut) {
        setError('Please select check-in and check-out dates.')
        return false
      }
      if (nights <= 0) {
        setError('Check-out must be after check-in.')
        return false
      }
      if (nights < room.minimum_nights_short_term) {
        setError(
          `Minimum stay is ${room.minimum_nights_short_term} night${room.minimum_nights_short_term !== 1 ? 's' : ''}.`
        )
        return false
      }
      if (blockedSet.has(checkIn) || isRangeBlocked(checkIn, checkOut, blockedSet)) {
        setError('One or more selected dates are unavailable.')
        return false
      }
    } else {
      if (!moveIn) {
        setError('Please select a move-in date.')
        return false
      }
      if (blockedSet.has(moveIn)) {
        setError('Selected move-in date is unavailable.')
        return false
      }
      const effectiveMin = minMoveIn && minMoveIn > today ? minMoveIn : today
      if (moveIn < effectiveMin) {
        setError(
          `Move-in date must be on or after ${format(parseISO(effectiveMin), 'MMMM d, yyyy')}.`
        )
        return false
      }
    }
    return true
  }, [bookingType, checkIn, checkOut, moveIn, nights, room.minimum_nights_short_term, blockedSet])

  const handleBook = useCallback(() => {
    if (!validate()) return

    if (bookingType === 'long_term') {
      const params = new URLSearchParams({
        room: room.slug,
        room_name: room.name,
        property_name: room.property?.name ?? '',
        move_in: moveIn,
        occupants: String(guests),
      })
      router.push(`/apply?${params.toString()}`)
      return
    }

    const params = new URLSearchParams({
      room_id: room.id,
      room: room.slug,
      room_name: room.name,
      type: bookingType,
      guests: String(guests),
      nightly_rate: String(room.nightly_rate),
      monthly_rate: String(room.monthly_rate),
      cleaning_fee: String(cleaningFee),
      security_deposit: String(securityDeposit),
      extra_guest_fee: String(extraGuestFee),
      fees: JSON.stringify(roomFees),
      checkin: checkIn,
      checkout: checkOut,
      total_nights: String(nights),
      total_amount: String(stTotal),
      amount_to_pay: String(stTotal),
      amount_due: '0',
    })
    router.push(`/checkout?${params.toString()}`)
  }, [
    validate, room, bookingType, guests, checkIn, checkOut, moveIn, nights,
    cleaningFee, securityDeposit, extraGuestFee, roomFees, stTotal, router,
  ])

  const guestOptions = Array.from({ length: Math.max(room.guest_capacity ?? 1, 1) }, (_, i) => i + 1)

  const GuestSelector = (
    <div>
      <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2">
        Guests
      </label>
      <div className="flex gap-2 flex-wrap">
        {guestOptions.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setGuests(n)}
            className={[
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
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
      {showNightly && showMonthly && (
        <div className="flex gap-2 p-1 bg-surface-container rounded-2xl">
          <button
            type="button"
            className={`${pillBase} ${bookingType === 'short_term' ? pillActive : pillInactive}`}
            onClick={() => {
              setBookingType('short_term')
              setError('')
            }}
          >
            Short-term (Nightly)
          </button>
          <button
            type="button"
            className={`${pillBase} ${bookingType === 'long_term' ? pillActive : pillInactive}`}
            onClick={() => {
              setBookingType('long_term')
              setError('')
            }}
          >
            Long-term (Monthly)
          </button>
        </div>
      )}

      {bookingType === 'short_term' && (
        <div className="space-y-3">
          {isShortTermWindowBlocked ? (
            <p className="text-sm text-on-surface-variant py-4 text-center rounded-xl bg-surface-container/50">
              This room is not currently accepting short-term reservations.
            </p>
          ) : (
            <>
              <div>
                <DateRangePicker
                  checkIn={checkIn}
                  checkOut={checkOut}
                  onCheckInChange={(d) => { setCheckIn(d); setCheckOut(''); setError('') }}
                  onCheckOutChange={(d) => { setCheckOut(d); setError('') }}
                  min={today}
                  max={shortTermWindowEnd}
                  minNights={room.minimum_nights_short_term}
                  checkOutMax={checkOutMax}
                  blockedDates={blockedDates}
                />
              </div>

              {GuestSelector}


              {nights > 0 && (
                <div className="bg-surface-container rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-on-surface-variant">
                    <span>
                      {nights} night{nights !== 1 ? 's' : ''}
                      {!hasRateVariation && ` × $${room.nightly_rate.toLocaleString()}`}
                    </span>
                    <span>${subtotal.toLocaleString()}</span>
                  </div>
                  {cleaningFee > 0 && (
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Cleaning fee</span>
                      <span>${cleaningFee.toLocaleString()}</span>
                    </div>
                  )}
                  {stExtraGuestTotal > 0 && (
                    <div className="flex justify-between text-on-surface-variant">
                      <span>
                        Extra guests ({extraGuests} × ${extraGuestFee}/night)
                      </span>
                      <span>${stExtraGuestTotal.toLocaleString()}</span>
                    </div>
                  )}
                  {stGenericFees.map((f) => (
                    <div key={f.id} className="flex justify-between text-on-surface-variant">
                      <span>{f.label}</span>
                      <span>${f.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  {room.airbnb_listing_id && (
                    <a
                      href={buildAirbnbUrl(room.airbnb_listing_id, { checkIn, checkOut, guests })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full border border-secondary/50 text-secondary rounded-xl py-2 text-sm font-medium hover:bg-secondary/5 transition-colors"
                    >
                      <AirbnbLogoIcon className="w-4 h-4 text-[#FF5A5F]" />
                      See these dates on Airbnb ↗
                    </a>
                  )}
                  <div className="flex justify-between pt-2 border-t border-outline-variant">
                    <span className="text-on-surface font-medium">Due today</span>
                    <span className="text-primary font-bold text-lg">${stTotal.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant/60 italic">Processing fee added at checkout</p>
                </div>
              )}

              <p className="text-xs text-on-surface-variant">
                Min. {room.minimum_nights_short_term} night{room.minimum_nights_short_term !== 1 ? 's' : ''}
              </p>
            </>
          )}
        </div>
      )}

      {bookingType === 'long_term' && (
        <div className="space-y-3">
          {isLongTermWindowBlocked ? (
            <p className="text-sm text-on-surface-variant py-4 text-center rounded-xl bg-surface-container/50">
              This room is not currently accepting long-term reservations.
            </p>
          ) : (
            <>
              <div className="bg-surface-highest/40 rounded-xl px-3 py-2.5">
                <DatePicker
                  label="Move-in Date"
                  value={moveIn}
                  onChange={(d) => {
                    setMoveIn(d)
                    setError('')
                  }}
                  min={minMoveIn && minMoveIn > today ? minMoveIn : today}
                  max={longTermWindowEnd}
                  placeholder="Add date"
                  blockedDates={blockedDates}
                />
              </div>
              {minMoveIn && minMoveIn > today && (
                <p className="text-xs text-on-surface-variant">
                  Earliest available:{' '}
                  {format(parseISO(minMoveIn), 'MMMM d, yyyy')}
                </p>
              )}

              {GuestSelector}

              {moveIn && (
                <div className="bg-surface-container rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-on-surface-variant">
                    <span>First month</span>
                    <span>${room.monthly_rate.toLocaleString()}</span>
                  </div>
                  {securityDeposit > 0 && (
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Security deposit</span>
                      <span>${securityDeposit.toLocaleString()}</span>
                    </div>
                  )}
                  {ltExtraGuestTotal > 0 && (
                    <div className="flex justify-between text-on-surface-variant">
                      <span>
                        Extra guests ({extraGuests} × ${extraGuestFee}/month)
                      </span>
                      <span>${ltExtraGuestTotal.toLocaleString()}</span>
                    </div>
                  )}
                  {ltGenericFees.map((f) => (
                    <div key={f.id} className="flex justify-between text-on-surface-variant">
                      <span>{f.label}</span>
                      <span>${f.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-outline-variant">
                    <span className="text-on-surface font-medium">Due today</span>
                    <span className="text-primary font-bold text-2xl">${ltTotal.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant/60 italic">Processing fee added at checkout</p>
                </div>
              )}

              <p className="text-xs text-on-surface-variant">
                Min. {room.minimum_nights_long_term} days. Deposit is non-refundable.
              </p>
            </>
          )}
        </div>
      )}

      {!currentTypeBlocked && error && (
        <p className="text-sm text-error bg-error-container/30 rounded-xl px-4 py-2">{error}</p>
      )}

      {!currentTypeBlocked && (
        <>
          <button
            onClick={handleBook}
            className="w-full bg-gradient-to-r from-primary to-secondary text-background font-display font-semibold py-3 rounded-2xl shadow-[0_0_10px_rgba(45,212,191,0.30)] hover:opacity-90 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {bookingType === 'long_term' ? 'Apply Now' : 'Book Now'}
          </button>
          <p className="text-center text-xs text-on-surface-variant mt-2">
            Bookings require admin approval. You will not be charged until approved.
          </p>
        </>
      )}
      {room.airbnb_listing_id && (
        <a
          href={buildAirbnbUrl(
            room.airbnb_listing_id,
            checkIn && checkOut
              ? { checkIn, checkOut, guests }
              : moveIn
              ? { checkIn: moveIn, guests }
              : undefined,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-on-surface-variant hover:text-[#FF5A5F] transition-colors"
        >
          <AirbnbLogoIcon className="w-3.5 h-3.5 text-[#FF5A5F]" />
          Compare on Airbnb
          <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  )
}
