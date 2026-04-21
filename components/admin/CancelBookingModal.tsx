'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Booking, CancellationPolicy } from '@/types'
import { calculateRefund } from '@/lib/cancellation'
import { formatCurrency } from '@/lib/format'

type RefundChoice = 'full' | 'half' | 'none'

type Props = {
  booking: Booking
  cancellationPolicy: CancellationPolicy
  onCancel: () => void
  onClose: () => void
  contained?: boolean
}

export default function CancelBookingModal({ booking, cancellationPolicy, onCancel, onClose, contained }: Props) {
  const policy = calculateRefund(booking, new Date(), cancellationPolicy)

  // Pre-select the option that matches the policy
  const policyDefault: RefundChoice =
    policy.refund_percentage === 100 ? 'full'
    : policy.refund_percentage > 0 ? 'half'
    : 'none'

  const [refundChoice, setRefundChoice] = useState<RefundChoice>(policyDefault)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processingFee = booking.processing_fee ?? 0
  const refundableBase = booking.amount_paid - processingFee
  const fullAmount = Math.round(refundableBase * 100) / 100
  const halfAmount = Math.round(refundableBase * (cancellationPolicy.partial_refund_percent / 100) * 100) / 100

  const choiceAmount =
    refundChoice === 'full' ? fullAmount
    : refundChoice === 'half' ? halfAmount
    : 0

  const options: { value: RefundChoice; label: string; amount: number; sub: string }[] = [
    { value: 'full', label: 'Full Refund', amount: fullAmount, sub: '100%' },
    { value: 'half', label: `${cancellationPolicy.partial_refund_percent}% Refund`, amount: halfAmount, sub: `${cancellationPolicy.partial_refund_percent}%` },
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

  const content = (
    <div
      className={contained
        ? 'absolute inset-0 z-10 flex items-center justify-center p-4'
        : 'fixed inset-0 z-[200] flex items-center justify-center p-4'}
      style={contained
        ? { backdropFilter: 'blur(10px)', background: 'rgba(248,250,252,0.88)' }
        : { backdropFilter: 'blur(4px)', background: 'rgba(15,23,42,0.35)' }}
    >
      <div className="w-full max-w-md bg-surface-container rounded-2xl p-6 shadow-2xl space-y-5">
        <h2 className="font-display text-xl font-bold text-on-surface">Cancel Booking</h2>

        {/* Policy breakdown */}
        <div className="rounded-xl bg-surface-highest/40 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-on-surface uppercase tracking-wider">Cancellation Policy</p>
          {booking.booking_type === 'long_term' ? (
            <p className="text-xs text-on-surface-variant">{policy.policy_description}</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <div className={[
                  'flex items-center justify-between rounded-lg px-3 py-2',
                  policy.refund_percentage === 100 ? 'bg-green-400/15 ring-1 ring-green-400/30' : '',
                ].join(' ')}>
                  <span className="text-xs text-on-surface-variant">&gt; {cancellationPolicy.full_refund_days} days before check-in</span>
                  <span className="text-xs font-semibold text-green-400">Full refund</span>
                </div>
                <div className={[
                  'flex items-center justify-between rounded-lg px-3 py-2',
                  policy.refund_percentage > 0 && policy.refund_percentage < 100 ? 'bg-amber-400/15 ring-1 ring-amber-400/30' : '',
                ].join(' ')}>
                  <span className="text-xs text-on-surface-variant">&gt; {cancellationPolicy.partial_refund_hours} hrs but ≤ {cancellationPolicy.full_refund_days} days</span>
                  <span className="text-xs font-semibold text-amber-400">{cancellationPolicy.partial_refund_percent}% refund</span>
                </div>
                <div className={[
                  'flex items-center justify-between rounded-lg px-3 py-2',
                  policy.refund_percentage === 0 ? 'bg-error/15 ring-1 ring-error/30' : '',
                ].join(' ')}>
                  <span className="text-xs text-on-surface-variant">≤ {cancellationPolicy.partial_refund_hours} hrs before check-in</span>
                  <span className="text-xs font-semibold text-error">No refund</span>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant pt-0.5">
                <span className="font-semibold text-on-surface">Currently applies: </span>{policy.policy_description}
              </p>
            </>
          )}
        </div>

        {/* Refund options */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Refund Amount
          </p>
          {processingFee > 0 && (
            <p className="text-xs text-on-surface-variant bg-surface-highest/40 rounded-lg px-3 py-2">
              Processing fee of <span className="font-semibold text-on-surface">{formatCurrency(processingFee)}</span> is non-refundable and excluded from the amounts below.
            </p>
          )}
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

  if (!contained) {
    return createPortal(content, document.body)
  }
  return content
}
