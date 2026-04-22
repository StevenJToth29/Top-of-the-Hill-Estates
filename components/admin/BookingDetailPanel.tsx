'use client'

import { useState, useEffect } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Booking, Room, Property, BookingModificationRequest, CancellationPolicy } from '@/types'
import { calculateRefund, DEFAULT_POLICY } from '@/lib/cancellation'
import { formatCurrency, formatDate, formatDateTime, OPEN_ENDED_DATE } from '@/lib/format'
import CancelBookingModal from './CancelBookingModal'
import EditBookingForm from './EditBookingForm'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const todayStr = new Date().toISOString().split('T')[0]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  confirmed: { label: 'Confirmed', color: '#059669', bg: 'rgba(5,150,105,0.08)',  border: 'rgba(5,150,105,0.2)' },
  pending:   { label: 'Pending',   color: '#D97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.2)' },
  cancelled: { label: 'Cancelled', color: '#DC2626', bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.18)' },
  completed: { label: 'Completed', color: '#2563EB', bg: 'rgba(37,99,235,0.07)',  border: 'rgba(37,99,235,0.2)' },
}

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  direct:         { label: 'Direct',      color: '#1FB2A0', bg: 'rgba(45,212,191,0.08)' },
  airbnb:         { label: 'Airbnb',      color: '#E61E4D', bg: 'rgba(230,30,77,0.07)' },
  vrbo:           { label: 'VRBO',        color: '#1C6AB1', bg: 'rgba(28,106,177,0.08)' },
  'booking.com':  { label: 'Booking.com', color: '#003580', bg: 'rgba(0,53,128,0.07)' },
  other:          { label: 'Other',       color: '#64748B', bg: '#F1F5F9' },
}

type Props = {
  booking: Booking & { room: Room & { property: Property } }
  modificationRequests?: BookingModificationRequest[]
  cancellationPolicy?: CancellationPolicy
}

function Row({
  label,
  val,
  valStyle,
}: {
  label: string
  val: React.ReactNode
  valStyle?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #F8FAFC' }}>
      <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0, width: 110 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', textAlign: 'right', ...valStyle }}>{val}</span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', marginTop: 8, marginBottom: 2 }}>
      {children}
    </div>
  )
}

export default function BookingDetailPanel({ booking, modificationRequests = [], cancellationPolicy }: Props) {
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editedBooking, setEditedBooking] = useState(booking)
  const b = editedBooking
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    setEditedBooking(booking)
  }, [booking])

  function handleClose() {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('id')
    router.push(`${pathname}?${next.toString()}`)
  }

  const isOpenEnded = b.check_out === OPEN_ENDED_DATE
  const nights = isOpenEnded
    ? null
    : (b.total_nights || differenceInCalendarDays(parseISO(b.check_out), parseISO(b.check_in)))

  const canCancel = b.status === 'confirmed' || b.status === 'pending'
  const refund = canCancel ? calculateRefund(b, new Date(), cancellationPolicy ?? DEFAULT_POLICY) : null

  function handleCancelled() {
    setShowCancelModal(false)
    router.refresh()
  }

  async function handleConfirm() {
    setConfirming(true)
    try {
      await fetch(`/api/admin/bookings/${booking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      })
      handleClose()
      router.refresh()
    } finally {
      setConfirming(false)
    }
  }

  const room = b.room
  const property = room?.property

  const statusCfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.other
  const sourceCfg = SOURCE_CONFIG[b.source ?? 'direct'] ?? SOURCE_CONFIG.other

  const guestInitials = [b.guest_first_name?.[0], b.guest_last_name?.[0]].filter(Boolean).join('').toUpperCase()

  const totalPaid = b.amount_paid ?? 0
  const totalAmount = b.total_amount ?? 0
  const due = totalAmount - totalPaid
  const paidPct = totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0
  const fullyPaid = due <= 0

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.25)',
          backdropFilter: 'blur(2px)',
          zIndex: 99,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          height: '100vh',
          width: 400,
          zIndex: 100,
          background: '#FFFFFF',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
      >
        {/* Inner scroll container */}
        <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Sticky Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: '#FFFFFF',
            borderBottom: '1px solid #F1F5F9',
            padding: '20px 20px 16px',
          }}
        >
          {/* Top row: id + name left, close right */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', marginBottom: 4 }}>
                #{b.id.slice(0, 8)}
              </div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
                {b.guest_first_name} {b.guest_last_name}
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                fontSize: 18,
                color: '#94A3B8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* Badge row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {/* Status badge */}
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>
              {statusCfg.label}
            </span>
            {/* Source badge */}
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: sourceCfg.bg, color: sourceCfg.color }}>
              {sourceCfg.label}
            </span>
            {/* Type badge */}
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#F1F5F9', color: '#64748B' }}>
              {b.booking_type === 'short_term' ? 'Short-term' : 'Long-term'}
            </span>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, padding: '0 20px' }}>

          {/* Guest card */}
          <div style={{ margin: '16px 0', padding: 14, background: 'rgba(45,212,191,0.08)', borderRadius: 12, border: '1px solid rgba(45,212,191,0.22)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(45,212,191,0.2)', color: '#1FB2A0', fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {guestInitials || '?'}
            </div>
            <div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                {b.guest_first_name} {b.guest_last_name}
              </div>
              {b.guest_email && (
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{b.guest_email}</div>
              )}
              {b.guest_phone && (
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>{b.guest_phone}</div>
              )}
            </div>
          </div>

          {/* Stay Details */}
          <SectionLabel>Stay Details</SectionLabel>
          {room?.name && <Row label="Room" val={room.name} />}
          {property?.name && <Row label="Property" val={property.name} />}
          <Row
            label="Check-in"
            val={
              b.check_in === todayStr
                ? <span><span style={{ color: '#1FB2A0' }}>{formatDate(b.check_in)}</span> <span style={{ color: '#1FB2A0', fontSize: 11 }}>· Today</span></span>
                : formatDate(b.check_in)
            }
          />
          <Row
            label="Check-out"
            val={
              isOpenEnded
                ? 'Open-ended'
                : b.check_out === todayStr
                  ? <span style={{ color: '#D97706' }}>{formatDate(b.check_out)}</span>
                  : formatDate(b.check_out)
            }
          />
          <Row
            label="Duration"
            val={
              isOpenEnded
                ? 'Open-ended'
                : nights !== null
                  ? `${nights} night${nights !== 1 ? 's' : ''}`
                  : '—'
            }
          />
          <Row label="Guests" val={String(b.guest_count ?? '—')} />

          {/* Payment */}
          <SectionLabel>Payment</SectionLabel>
          <Row label="Total" val={formatCurrency(totalAmount)} />
          <Row label="Paid" val={formatCurrency(totalPaid)} valStyle={{ color: '#059669' }} />
          <Row
            label="Outstanding"
            val={
              fullyPaid
                ? 'Fully paid ✓'
                : formatCurrency(due)
            }
            valStyle={{ color: fullyPaid ? '#059669' : '#DC2626' }}
          />

          {/* Progress bar */}
          <div style={{ padding: '8px 0 4px' }}>
            <div style={{ height: 6, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${paidPct}%`, borderRadius: 999, background: fullyPaid ? '#059669' : '#D97706', transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{paidPct}% of total collected</div>
          </div>

          <Row label="Due at Check-in" val={formatCurrency(b.amount_due_at_checkin)} />
          {b.stripe_payment_intent_id && (
            <Row
              label="Stripe"
              val={
                <a
                  href={`https://dashboard.stripe.com/payments/${b.stripe_payment_intent_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2DD4BF', textDecoration: 'none', fontSize: 12, wordBreak: 'break-all' }}
                >
                  {b.stripe_payment_intent_id}
                </a>
              }
            />
          )}

          {/* Notes */}
          {b.notes && (
            <div style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: 10, padding: 12, margin: '16px 0' }}>
              <SectionLabel>Notes</SectionLabel>
              <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, marginTop: 6 }}>{b.notes}</div>
            </div>
          )}

          {/* Booking Info */}
          <SectionLabel>Booking Info</SectionLabel>
          <Row label="Booking ID" val={<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.id}</span>} />
          <Row
            label="Source"
            val={<span style={{ color: sourceCfg.color }}>{sourceCfg.label}</span>}
          />
          <Row label="Created" val={formatDateTime(b.created_at)} />
          {b.ghl_contact_id && (
            <Row label="GHL Contact" val={<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.ghl_contact_id}</span>} />
          )}
          {b.cancelled_at && (
            <Row label="Cancelled At" val={formatDateTime(b.cancelled_at)} />
          )}
          {b.cancellation_reason && (
            <Row label="Cancel Reason" val={b.cancellation_reason} />
          )}
          {b.refund_amount != null && (
            <Row label="Refund Amount" val={formatCurrency(b.refund_amount)} />
          )}

          {/* Cancellation policy section */}
          {canCancel && refund && (
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, margin: '16px 0' }}>
              <SectionLabel>Cancellation Policy</SectionLabel>
              <p style={{ fontSize: 13, color: '#64748B', margin: '8px 0 6px', lineHeight: 1.5 }}>{refund.policy_description}</p>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 10 }}>
                Estimated refund:{' '}
                <strong style={{ color: '#0F172A' }}>{formatCurrency(refund.refund_amount)}</strong>{' '}
                ({refund.refund_percentage}%)
              </p>
              <button
                onClick={() => setShowCancelModal(true)}
                style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.18)', color: '#DC2626', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel Booking
              </button>
            </div>
          )}

          {/* Modification requests */}
          {modificationRequests.length > 0 && (
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, margin: '16px 0 24px' }}>
              <SectionLabel>Modification Requests</SectionLabel>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {modificationRequests.map((req) => (
                  <ModificationRequestRow key={req.id} req={req} bookingId={b.id} />
                ))}
              </div>
            </div>
          )}

          {/* Bottom spacer when no modification requests */}
          {modificationRequests.length === 0 && <div style={{ height: 24 }} />}
        </div>

        {/* Sticky Footer */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: '#FFFFFF',
            borderTop: '1px solid #F1F5F9',
            padding: '14px 20px',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {b.status === 'pending' && (
            <button
              onClick={handleConfirm}
              disabled={confirming}
              style={{ background: '#2DD4BF', color: '#0F172A', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: confirming ? 'not-allowed' : 'pointer', opacity: confirming ? 0.7 : 1 }}
            >
              {confirming ? 'Confirming…' : '✓ Confirm Booking'}
            </button>
          )}
          {b.status !== 'cancelled' && (
            <button
              onClick={() => setShowCancelModal(true)}
              style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.18)', color: '#DC2626', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Cancel Booking
            </button>
          )}
          {b.status !== 'cancelled' && b.status !== 'completed' && (
            <button
              onClick={() => setShowEditForm(true)}
              style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#475569', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              ✏ Edit
            </button>
          )}
        </div>
        </div>{/* end inner scroll container */}

        {showCancelModal && (
          <CancelBookingModal
            contained
            booking={b as Booking & { room: Room & { property: Property } }}
            cancellationPolicy={cancellationPolicy ?? DEFAULT_POLICY}
            onCancel={handleCancelled}
            onClose={() => setShowCancelModal(false)}
          />
        )}
        {showEditForm && (
          <EditBookingForm
            booking={b as Booking & { room: Room & { property: Property } }}
            onClose={() => setShowEditForm(false)}
            onSaved={(updated) => {
              setEditedBooking({ ...updated, room: b.room } as typeof b)
              setShowEditForm(false)
            }}
          />
        )}
      </div>
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
