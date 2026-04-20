'use client'

import { useState } from 'react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import DatePicker from '@/components/public/DatePicker'
import CancellationPolicyDisplay from '@/components/public/CancellationPolicyDisplay'
import type { Booking, Room, Property, BookingModificationRequest, CancellationPolicy } from '@/types'

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
function fmtCurrency(n: number) {
  return currencyFmt.format(n)
}
function fmtDate(iso: string) {
  try {
    return format(parseISO(iso + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
  } catch {
    return iso
  }
}

interface Props {
  booking: Booking & { room: Room & { property: Property } }
  windowHours: number
  withinWindow: boolean
  refundAmount: number
  refundPercentage: number
  policyDescription: string
  cancellationPolicy: CancellationPolicy
  latestRequest: BookingModificationRequest | null
  blockedDates: string[]
  genericFeesTotal: number
}

export default function BookingManageView({
  booking,
  windowHours,
  withinWindow,
  refundAmount,
  refundPercentage,
  policyDescription,
  cancellationPolicy,
  latestRequest,
  blockedDates,
  genericFeesTotal,
}: Props) {
  const room = booking.room
  const property = room.property

  const isActive = booking.status === 'confirmed' || booking.status === 'pending'
  const isCancelled = booking.status === 'cancelled'
  const isCompleted = booking.status === 'completed'

  // Cancel state
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSuccess, setCancelSuccess] = useState(false)
  const [cancelledRefund, setCancelledRefund] = useState<number | null>(null)

  // Modify state
  const [modCheckIn, setModCheckIn] = useState(booking.check_in)
  const [modCheckOut, setModCheckOut] = useState(booking.check_out)
  const [modGuestCount, setModGuestCount] = useState(booking.guest_count)
  const [modLoading, setModLoading] = useState(false)
  const [modError, setModError] = useState<string | null>(null)
  const [modSuccess, setModSuccess] = useState(false)
  const [modPriceDelta, setModPriceDelta] = useState<number | null>(null)
  const [modNewTotal, setModNewTotal] = useState<number | null>(null)

  // Client-side price delta preview
  const totalNightsPreview = differenceInCalendarDays(parseISO(modCheckOut), parseISO(modCheckIn))
  const extraGuests = Math.max(0, modGuestCount - 1)
  const extraGuestFeePerNight = room.extra_guest_fee ?? 0

  let previewTotal = 0
  if (totalNightsPreview > 0) {
    if (booking.booking_type === 'short_term') {
      previewTotal =
        totalNightsPreview * (room.nightly_rate ?? 0) +
        (room.cleaning_fee ?? 0) +
        extraGuests * extraGuestFeePerNight * totalNightsPreview +
        genericFeesTotal
    } else {
      previewTotal =
        (room.monthly_rate ?? 0) +
        (room.security_deposit ?? 0) +
        extraGuests * extraGuestFeePerNight +
        genericFeesTotal
    }
  }
  const previewDelta = previewTotal - booking.total_amount

  async function handleCancel() {
    setCancelLoading(true)
    setCancelError(null)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_email: booking.guest_email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to cancel booking')
      setCancelSuccess(true)
      setCancelledRefund(data.refund_amount)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCancelLoading(false)
    }
  }

  async function handleModify(e: React.FormEvent) {
    e.preventDefault()
    setModLoading(true)
    setModError(null)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_email: booking.guest_email,
          check_in: modCheckIn,
          check_out: modCheckOut,
          guest_count: modGuestCount,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit modification')
      setModSuccess(true)
      setModPriceDelta(data.price_delta)
      setModNewTotal(data.new_total)
    } catch (err) {
      setModError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setModLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors font-body"
      >
        <span>←</span> Back
      </button>

      {/* Booking summary */}
      <div className="bg-surface-container rounded-2xl p-6 shadow-[0_8px_40px_rgba(45,212,191,0.06)]">
        <h1 className="font-display text-2xl font-bold text-primary mb-4">Your Booking</h1>
        <div className="space-y-1 font-body text-on-surface-variant text-sm">
          <p className="text-on-surface font-semibold text-base">{room.name}</p>
          <p>{property.name}</p>
          <p>
            {property.address}, {property.city}, {property.state}
          </p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-xs text-on-surface-variant mb-0.5">Check-in</p>
              <p className="text-on-surface font-medium">{fmtDate(booking.check_in)}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant mb-0.5">Check-out</p>
              <p className="text-on-surface font-medium">{fmtDate(booking.check_out)}</p>
            </div>
          </div>
          <p className="mt-2">
            Guests: <span className="text-on-surface">{booking.guest_count}</span>
          </p>
          <p>
            Total paid:{' '}
            <span className="text-on-surface font-semibold">{fmtCurrency(booking.amount_paid)}</span>
          </p>
        </div>
      </div>

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="bg-error/10 rounded-2xl p-5 font-body">
          <p className="text-error font-semibold">This reservation has been cancelled.</p>
          {booking.refund_amount != null && booking.refund_amount > 0 && (
            <p className="text-on-surface-variant text-sm mt-1">
              Refund issued: {fmtCurrency(booking.refund_amount)}
            </p>
          )}
        </div>
      )}

      {/* Completed banner */}
      {isCompleted && (
        <div className="bg-primary/10 rounded-2xl p-5 font-body">
          <p className="text-primary font-semibold">
            This stay has been completed. We hope you enjoyed it!
          </p>
        </div>
      )}

      {/* Cancel success */}
      {cancelSuccess && (
        <div className="bg-secondary/10 rounded-2xl p-5 font-body">
          <p className="text-secondary font-semibold">Your reservation has been cancelled.</p>
          {cancelledRefund != null && cancelledRefund > 0 ? (
            <p className="text-on-surface-variant text-sm mt-1">
              A refund of {fmtCurrency(cancelledRefund)} has been issued to your original payment
              method.
            </p>
          ) : (
            <p className="text-on-surface-variant text-sm mt-1">
              No refund applies per the cancellation policy.
            </p>
          )}
        </div>
      )}

      {/* Within-window notice — modifications only */}
      {isActive && withinWindow && !cancelSuccess && (
        <div className="bg-surface-highest/40 rounded-2xl p-5 font-body">
          <p className="text-on-surface-variant text-sm">
            Date modifications are no longer available within {windowHours} hours of check-in.
            Please contact us directly if you need to change your dates.
          </p>
        </div>
      )}

      {/* Actions — all active bookings */}
      {isActive && !cancelSuccess && (
        <>
          {/* Cancel section */}
          <div className="bg-surface-container rounded-2xl p-6 space-y-3">
            <h2 className="font-display text-lg font-semibold text-primary">Cancellation</h2>
            <CancellationPolicyDisplay
              variant={booking.booking_type}
              policy={cancellationPolicy}
            />
            <p className="font-body text-on-surface-variant text-sm">{policyDescription}</p>
            {refundPercentage > 0 ? (
              <p className="font-body text-sm text-on-surface-variant">
                Expected refund:{' '}
                <span className="text-on-surface font-semibold">{fmtCurrency(refundAmount)}</span>{' '}
                ({refundPercentage}%)
              </p>
            ) : (
              <p className="font-body text-sm text-on-surface-variant">
                No refund applies at this time.
              </p>
            )}
            {cancelError && <p className="text-error text-sm font-body">{cancelError}</p>}
            {!cancelConfirm ? (
              <button
                onClick={() => setCancelConfirm(true)}
                className="rounded-xl bg-error/20 px-4 py-2 text-sm font-semibold text-error hover:bg-error/30 transition-colors font-body"
              >
                Cancel Reservation
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-on-surface-variant font-body">
                  Are you sure? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    className="rounded-xl bg-error/20 px-4 py-2 text-sm font-semibold text-error hover:bg-error/30 transition-colors disabled:opacity-50 font-body"
                  >
                    {cancelLoading ? 'Cancelling…' : 'Yes, Cancel'}
                  </button>
                  <button
                    onClick={() => setCancelConfirm(false)}
                    className="rounded-xl bg-surface-highest/40 px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-highest/60 transition-colors font-body"
                  >
                    Keep Booking
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modify section — only outside the cancellation window */}
          {!withinWindow && modSuccess ? (
            <div className="bg-secondary/10 rounded-2xl p-6 font-body">
              <h2 className="font-display text-lg font-semibold text-primary mb-2">
                Modification Requested
              </h2>
              <p className="text-on-surface-variant text-sm">
                Your request has been submitted. The host will review and be in touch soon.
              </p>
              {modPriceDelta !== null && modPriceDelta > 0 && (
                <p className="text-sm text-on-surface-variant mt-2">
                  The new total would be {fmtCurrency(modNewTotal!)} —{' '}
                  {fmtCurrency(modPriceDelta)} more than paid. The host will contact you about the
                  difference.
                </p>
              )}
              {modPriceDelta !== null && modPriceDelta < 0 && (
                <p className="text-sm text-on-surface-variant mt-2">
                  The new total would be {fmtCurrency(modNewTotal!)} — you may be eligible for a{' '}
                  {fmtCurrency(Math.abs(modPriceDelta))} refund if approved.
                </p>
              )}
            </div>
          ) : latestRequest?.status === 'pending' ? (
            <div className="bg-surface-container rounded-2xl p-6 font-body">
              <h2 className="font-display text-lg font-semibold text-primary mb-2">
                Pending Modification Request
              </h2>
              <p className="text-on-surface-variant text-sm mb-3">
                Submitted on {format(parseISO(latestRequest.created_at), 'MMM d, yyyy')}. The host
                will be in touch soon.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-on-surface-variant mb-0.5">Requested check-in</p>
                  <p className="text-on-surface">{fmtDate(latestRequest.requested_check_in)}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant mb-0.5">Requested check-out</p>
                  <p className="text-on-surface">{fmtDate(latestRequest.requested_check_out)}</p>
                </div>
              </div>
              <p className="text-sm text-on-surface-variant mt-2">
                Guests: {latestRequest.requested_guest_count}
              </p>
              {latestRequest.admin_note && (
                <p className="text-sm text-on-surface-variant mt-2 italic">
                  {latestRequest.admin_note}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-surface-container rounded-2xl p-6">
              <h2 className="font-display text-lg font-semibold text-primary mb-4">
                Request a Change
              </h2>
              {latestRequest?.status === 'rejected' && (
                <div className="mb-4 p-3 bg-error/10 rounded-xl text-sm font-body">
                  <p className="text-error font-semibold">
                    Your previous modification request was not approved.
                  </p>
                  {latestRequest.admin_note && (
                    <p className="text-on-surface-variant mt-1">{latestRequest.admin_note}</p>
                  )}
                </div>
              )}
              <form onSubmit={handleModify} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DatePicker
                    label="New Check-in"
                    value={modCheckIn}
                    onChange={setModCheckIn}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    blockedDates={blockedDates}
                  />
                  <DatePicker
                    label="New Check-out"
                    value={modCheckOut}
                    onChange={setModCheckOut}
                    min={modCheckIn || format(new Date(), 'yyyy-MM-dd')}
                    blockedDates={blockedDates}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
                    Guests
                  </label>
                  <select
                    value={modGuestCount}
                    onChange={(e) => setModGuestCount(Number(e.target.value))}
                    className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 font-body"
                  >
                    {Array.from({ length: room.guest_capacity }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'guest' : 'guests'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price preview */}
                {totalNightsPreview > 0 && (
                  <div className="rounded-xl bg-surface-highest/40 p-4 text-sm font-body space-y-1">
                    <p className="text-on-surface-variant">
                      Estimated new total:{' '}
                      <span className="text-on-surface font-semibold">
                        {fmtCurrency(previewTotal)}
                      </span>
                    </p>
                    {previewDelta > 0 && (
                      <p className="text-secondary text-xs">
                        {fmtCurrency(previewDelta)} more than currently paid — the host will contact
                        you about the difference if approved.
                      </p>
                    )}
                    {previewDelta < 0 && (
                      <p className="text-primary text-xs">
                        You may be eligible for a {fmtCurrency(Math.abs(previewDelta))} refund if
                        this change is approved.
                      </p>
                    )}
                    {previewDelta === 0 && (
                      <p className="text-on-surface-variant text-xs">No price change.</p>
                    )}
                  </div>
                )}

                {modError && <p className="text-error text-sm font-body">{modError}</p>}
                <button
                  type="submit"
                  disabled={modLoading || totalNightsPreview <= 0}
                  className="w-full bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-8 py-3 font-semibold font-body disabled:opacity-50"
                >
                  {modLoading ? 'Submitting…' : 'Request Change'}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  )
}
