'use client'

import { useState } from 'react'
import type { Booking } from '@/types'
import { calculateRefund } from '@/lib/cancellation'
import { formatCurrency } from '@/lib/format'

type Props = {
  booking: Booking
  onCancel: () => void
  onClose: () => void
}

export default function CancelBookingModal({ booking, onCancel, onClose }: Props) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refund = calculateRefund(booking, new Date())

  async function handleConfirm() {
    if (!reason.trim()) {
      setError('A cancellation reason is required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`)
      }
      onCancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl p-4">
      <div className="w-full max-w-md bg-surface-container rounded-2xl p-6 shadow-2xl space-y-5">
        <h2 className="font-display text-xl font-bold text-on-surface">Cancel Booking</h2>

        <div className="rounded-xl bg-surface-highest/40 p-4 space-y-2">
          <p className="text-sm text-on-surface-variant">{refund.policy_description}</p>
          <p className="text-sm text-on-surface">
            Refund amount:{' '}
            <span className="font-semibold text-error">{formatCurrency(refund.refund_amount)}</span>{' '}
            <span className="text-on-surface-variant">({refund.refund_percentage}%)</span>
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-on-surface-variant" htmlFor="cancel-reason">
            Cancellation Reason <span className="text-error">*</span>
          </label>
          <textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for cancellation..."
            className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-secondary/50 outline-none resize-none"
          />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-error/20 px-4 py-3 text-sm font-semibold text-error hover:bg-error/30 transition-colors disabled:opacity-50"
          >
            {loading
              ? 'Cancelling…'
              : `Confirm Cancellation — Refund ${formatCurrency(refund.refund_amount)}`}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-highest/40 transition-colors disabled:opacity-50"
          >
            Keep Booking
          </button>
        </div>
      </div>
    </div>
  )
}
