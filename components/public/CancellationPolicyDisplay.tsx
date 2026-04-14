import type { BookingType } from '@/types'

interface Props {
  variant?: BookingType
}

const shortTermPolicy = [
  {
    condition: '> 7 days before check-in',
    refund: 'Full refund',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  {
    condition: '> 72 hours but ≤ 7 days',
    refund: '50% refund',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  {
    condition: '≤ 72 hours before check-in',
    refund: 'No refund',
    color: 'text-error',
    bg: 'bg-error/10',
  },
]

const longTermPolicy = [
  {
    condition: 'Deposit',
    refund: 'Non-refundable',
    color: 'text-error',
    bg: 'bg-error/10',
  },
]

export default function CancellationPolicyDisplay({ variant = 'short_term' }: Props) {
  const policy = variant === 'long_term' ? longTermPolicy : shortTermPolicy

  return (
    <div className="bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-5 space-y-4">
      <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
        Cancellation Policy
      </p>
      <div className="space-y-2">
        {policy.map((row) => (
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
