'use client'

import { useState } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Booking, Room, Property } from '@/types'
import { calculateRefund } from '@/lib/cancellation'
import { formatCurrency, formatDate, formatDateTime, STATUS_BADGE } from '@/lib/format'
import clsx from 'clsx'
import CancelBookingModal from './CancelBookingModal'
import { useRouter } from 'next/navigation'

type Props = {
  booking: Booking & { room: Room & { property: Property } }
}

export default function BookingDetailPanel({ booking }: Props) {
  const [showCancelModal, setShowCancelModal] = useState(false)
  const router = useRouter()

  const nights =
    booking.total_nights ||
    differenceInCalendarDays(parseISO(booking.check_out), parseISO(booking.check_in))

  const canCancel = booking.status === 'confirmed' || booking.status === 'pending'
  const refund = canCancel ? calculateRefund(booking, new Date()) : null

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
            <Field label="Total Nights" value={`${nights} night${nights !== 1 ? 's' : ''}`} />
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
      </div>

      {showCancelModal && (
        <CancelBookingModal
          booking={booking}
          onCancel={handleCancelled}
          onClose={() => setShowCancelModal(false)}
        />
      )}
    </>
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
