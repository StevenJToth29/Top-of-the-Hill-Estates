'use client'

import { useState } from 'react'
import type { Booking } from '@/types'
import { calculateRefund } from '@/lib/cancellation'
import { formatCurrency } from '@/lib/format'

type RefundChoice = 'full' | 'half' | 'none'

type Props = {
  booking: Booking
  onCancel: () => void
  onClose: () => void
}

export default function CancelBookingModal({ booking, onCancel, onClose }: Props) {
  const policy = calculateRefund(booking, new Date())

  // Pre-select the option that matches the policy
  const policyDefault: RefundChoice =
    policy.refund_percentage === 100 ? 'full'
    : policy.refund_percentage === 50 ? 'half'
    : 'none'

  const [refundChoice, setRefundChoice] = useState<RefundChoice>(policyDefault)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fullAmount = booking.amount_paid
  const halfAmount = Math.round(booking.amount_paid * 0.5 * 100) / 100

  const choiceAmount =
    refundChoice === 'full' ? fullAmount
    : refundChoice === 'half' ? halfAmount
    : 0

  const options: { value: RefundChoice; label: string; amount: number; sub: string }[] = [
    { value: 'full', label: 'Full Refund', amount: fullAmount, sub: '100%' },
    { value: 'half', label: '50% Refund', amount: halfAmount, sub: '50%' },
    { value: 'none', label: 'No Refund', amount: 0, sub: '0%' },
  ]

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
        body: JSON.stringify({ reason: reason.trim(), refund_override: refundChoice }),
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

        {/* Policy note */}
        <div className="rounded-xl bg-surface-highest/40 px-4 py-3">
          <p className="text-xs text-on-surface-variant">
            <span className="font-semibold text-on-surface">Policy: </span>
            {policy.policy_description}
          </p>
        </div>

        {/* Refund options */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Refund Amount
          </p>
          <div className="grid grid-cols-3 gap-2">
            {options.map((opt) => {
              const isSelected = refundChoice === opt.value
              const isPolicy = opt.value === policyDefault
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRefundChoice(opt.value)}
                  className={[
                    'relative flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-center transition-colors',
                    isSelected
                      ? 'border-secondary bg-secondary/15 text-on-surface'
                      : 'border-outline-variant/40 bg-surface-highest/20 text-on-surface-variant hover:bg-surface-highest/40',
                  ].join(' ')}
                >
                  {isPolicy && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-secondary text-background text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      Policy
                    </span>
                  )}
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className={['text-base font-bold font-display', isSelected ? 'text-secondary' : ''].join(' ')}>
                    {formatCurrency(opt.amount)}
                  </span>
                  <span className="text-[10px] text-on-surface-variant">{opt.sub}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-1">
          <label className="text-xs text-on-surface-variant" htmlFor="cancel-reason">
            Cancellation Reason <span className="text-error">*</span>
          </label>
          <textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(null) }}
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
            {loading ? 'Cancelling…' : `Cancel & Refund ${formatCurrency(choiceAmount)}`}
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
