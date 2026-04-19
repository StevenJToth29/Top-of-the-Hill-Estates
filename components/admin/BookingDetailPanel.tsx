'use client'

import { useState } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Booking, Room, Property, BookingModificationRequest, CancellationPolicy } from '@/types'
import { calculateRefund, DEFAULT_POLICY } from '@/lib/cancellation'
import { formatCurrency, formatDate, formatDateTime, STATUS_BADGE, OPEN_ENDED_DATE } from '@/lib/format'
import clsx from 'clsx'
import CancelBookingModal from './CancelBookingModal'
import { useRouter } from 'next/navigation'

type Props = {
  booking: Booking & { room: Room & { property: Property } }
  modificationRequests?: BookingModificationRequest[]
  cancellationPolicy?: CancellationPolicy
}

export default function BookingDetailPanel({ booking, modificationRequests = [], cancellationPolicy }: Props) {
  const [showCancelModal, setShowCancelModal] = useState(false)
  const router = useRouter()

  const isOpenEnded = booking.check_out === OPEN_ENDED_DATE
  const nights = isOpenEnded
    ? null
    : (booking.total_nights || differenceInCalendarDays(parseISO(booking.check_out), parseISO(booking.check_in)))

  const canCancel = booking.status === 'confirmed' || booking.status === 'pending'
  const refund = canCancel ? calculateRefund(booking, new Date(), cancellationPolicy ?? DEFAULT_POLICY) : null

  function handleCancelled() {
    setShowCancelModal(false)
    router.refresh()
  }

  const room = booking.room
  const property = room?.property

  return (
    <>
      <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-on-surface">Booking Details</h2>
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-semibold capitalize',
                STATUS_BADGE[booking.status],
              )}
            >
              {booking.status}
            </span>
            <span className="rounded-full px-3 py-1 text-xs font-semibold bg-surface-highest/40 text-on-surface-variant capitalize">
              {booking.booking_type === 'short_term' ? 'Short-term' : 'Long-term'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Section title="Guest">
            <Field label="Name" value={`${booking.guest_first_name} ${booking.guest_last_name}`} />
            <Field label="Email" value={booking.guest_email} />
            <Field label="Phone" value={booking.guest_phone} />
            <Field label="SMS Consent" value={booking.sms_consent ? 'Yes' : 'No'} />
            <Field label="Marketing Consent" value={booking.marketing_consent ? 'Yes' : 'No'} />
          </Section>

          <Section title="Room">
            <Field label="Room" value={room?.name ?? '—'} />
            <Field label="Property" value={property?.name ?? '—'} />
            {property?.address && (
              <Field
                label="Address"
                value={`${property.address}, ${property.city}, ${property.state}`}
              />
            )}
          </Section>

          <Section title="Dates">
            <Field label="Check-in" value={formatDate(booking.check_in)} />
            <Field label="Check-out" value={formatDate(booking.check_out)} />
            {nights !== null && (
              <Field label="Total Nights" value={`${nights} night${nights !== 1 ? 's' : ''}`} />
            )}
          </Section>

          <Section title="Payment">
            <Field label="Total Amount" value={formatCurrency(booking.total_amount)} />
            <Field label="Amount Paid" value={formatCurrency(booking.amount_paid)} />
            <Field label="Due at Check-in" value={formatCurrency(booking.amount_due_at_checkin)} />
            {booking.stripe_payment_intent_id && (
              <div>
                <span className="text-xs text-on-surface-variant">Payment Intent</span>
                <a
                  href={`https://dashboard.stripe.com/payments/${booking.stripe_payment_intent_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-0.5 text-sm text-secondary hover:text-secondary/80 truncate"
                >
                  {booking.stripe_payment_intent_id}
                </a>
              </div>
            )}
          </Section>

          <Section title="Meta">
            {booking.ghl_contact_id && (
              <Field label="GHL Contact ID" value={booking.ghl_contact_id} />
            )}
            <Field label="Booking ID" value={booking.id} />
            <Field label="Created" value={formatDateTime(booking.created_at)} />
            {booking.cancelled_at && (
              <Field label="Cancelled At" value={formatDateTime(booking.cancelled_at)} />
            )}
            {booking.cancellation_reason && (
              <Field label="Cancellation Reason" value={booking.cancellation_reason} />
            )}
            {booking.refund_amount != null && (
              <Field label="Refund Amount" value={formatCurrency(booking.refund_amount)} />
            )}
          </Section>
        </div>

        {canCancel && refund && (
          <div className="rounded-xl bg-surface-container p-4 space-y-3">
            <h3 className="text-sm font-semibold text-on-surface">Cancellation Policy</h3>
            <p className="text-sm text-on-surface-variant">{refund.policy_description}</p>
            <p className="text-sm text-on-surface-variant">
              Estimated refund:{' '}
              <span className="font-semibold text-on-surface">
                {formatCurrency(refund.refund_amount)}
              </span>{' '}
              ({refund.refund_percentage}%)
            </p>
            <button
              onClick={() => setShowCancelModal(true)}
              className="rounded-xl bg-error/20 px-4 py-2 text-sm font-semibold text-error hover:bg-error/30 transition-colors"
            >
              Cancel Booking
            </button>
          </div>
        )}

        {modificationRequests.length > 0 && (
          <div className="rounded-xl bg-surface-container p-4 space-y-4">
            <h3 className="text-sm font-semibold text-on-surface">Modification Requests</h3>
            {modificationRequests.map((req) => (
              <ModificationRequestRow key={req.id} req={req} bookingId={booking.id} />
            ))}
          </div>
        )}
      </div>

      {showCancelModal && (
        <CancelBookingModal
          booking={booking}
          cancellationPolicy={cancellationPolicy ?? DEFAULT_POLICY}
          onCancel={handleCancelled}
          onClose={() => setShowCancelModal(false)}
        />
      )}
    </>
  )
}

function ModificationRequestRow({
  req,
  bookingId,
}: {
  req: BookingModificationRequest
  bookingId: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const router = useRouter()

  async function handleAction(action: 'approve' | 'reject') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/bookings/${bookingId}/modification-requests/${req.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, admin_note: note || undefined }),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Action failed')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const statusColor =
    req.status === 'pending'
      ? 'text-secondary'
      : req.status === 'approved'
        ? 'text-primary'
        : 'text-error'

  return (
    <div className="border border-outline-variant rounded-xl p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className={`font-semibold capitalize ${statusColor}`}>{req.status}</span>
        <span className="text-xs text-on-surface-variant">
          {formatDateTime(req.created_at)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-on-surface-variant">
        <div>
          <span className="text-xs">Check-in</span>
          <p className="text-on-surface">{formatDate(req.requested_check_in)}</p>
        </div>
        <div>
          <span className="text-xs">Check-out</span>
          <p className="text-on-surface">{formatDate(req.requested_check_out)}</p>
        </div>
        <div>
          <span className="text-xs">Guests</span>
          <p className="text-on-surface">{req.requested_guest_count}</p>
        </div>
        <div>
          <span className="text-xs">Price delta</span>
          <p className={req.price_delta >= 0 ? 'text-secondary' : 'text-primary'}>
            {req.price_delta >= 0 ? '+' : ''}
            {formatCurrency(req.price_delta)}
          </p>
        </div>
      </div>
      {req.admin_note && (
        <p className="text-on-surface-variant italic text-xs">Note: {req.admin_note}</p>
      )}
      {req.status === 'pending' && (
        <div className="space-y-2 pt-1">
          <input
            type="text"
            placeholder="Admin note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-surface-highest/40 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
          />
          {error && <p className="text-error text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => handleAction('approve')}
              disabled={loading}
              className="rounded-lg bg-secondary/20 px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-secondary/30 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => handleAction('reject')}
              disabled={loading}
              className="rounded-lg bg-error/20 px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/30 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-on-surface-variant">{label}</span>
      <p className="mt-0.5 text-sm text-on-surface break-all">{value}</p>
    </div>
  )
}
