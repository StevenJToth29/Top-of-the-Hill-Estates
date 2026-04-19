import type { BookingType, CancellationPolicy } from '@/types'

interface Props {
  variant?: BookingType
  policy: CancellationPolicy
}

export default function CancellationPolicyDisplay({ variant = 'short_term', policy }: Props) {
  if (variant === 'long_term') {
    return (
      <div className="bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-5 space-y-4">
        <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
          Cancellation Policy
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl px-4 py-3 bg-error/10">
            <span className="text-sm text-on-surface-variant">Deposit</span>
            <span className="text-sm font-semibold text-error">Non-refundable</span>
          </div>
        </div>
      </div>
    )
  }

  const rows = [
    {
      condition: `> ${policy.full_refund_days} days before check-in`,
      refund: 'Full refund',
      color: 'text-green-400',
      bg: 'bg-green-400/10',
    },
    {
      condition: `> ${policy.partial_refund_hours} hrs but ≤ ${policy.full_refund_days} days`,
      refund: `${policy.partial_refund_percent}% refund`,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
    },
    {
      condition: `≤ ${policy.partial_refund_hours} hours before check-in`,
      refund: 'No refund',
      color: 'text-error',
      bg: 'bg-error/10',
    },
  ]

  return (
    <div className="bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-5 space-y-4">
      <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
        Cancellation Policy
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.condition}
            className={`flex items-center justify-between rounded-xl px-4 py-3 ${row.bg}`}
          >
            <span className="text-sm text-on-surface-variant">{row.condition}</span>
            <span className={`text-sm font-semibold ${row.color}`}>{row.refund}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
