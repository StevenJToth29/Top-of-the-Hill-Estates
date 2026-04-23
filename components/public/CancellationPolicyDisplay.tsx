import type { BookingType, CancellationPolicy } from '@/types'

interface Props {
  variant?: BookingType
  policy: CancellationPolicy
}

export default function CancellationPolicyDisplay({ variant = 'short_term', policy }: Props) {
  if (variant === 'long_term') {
    return (
      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">Booking Protection</p>
          <p className="font-display text-lg font-bold text-on-surface mt-1">Cancellation Policy</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-error/10 border border-error/20">
          <div className="w-2.5 h-2.5 rounded-full bg-error shrink-0" />
          <div className="text-sm font-semibold text-error">Deposit is non-refundable</div>
        </div>
      </section>
    )
  }

  const rows = [
    {
      condition: `5+ days before check-in`,
      refund: 'Full refund',
      dot: 'bg-green-400',
      bar: 'bg-green-400/10 border-green-400/20',
      text: 'text-green-400',
    },
    {
      condition: `2–5 days before check-in`,
      refund: `${policy.partial_refund_percent}% refund`,
      dot: 'bg-amber-400',
      bar: 'bg-amber-400/10 border-amber-400/20',
      text: 'text-amber-400',
    },
    {
      condition: `Less than 48 hours`,
      refund: 'No refund',
      dot: 'bg-error',
      bar: 'bg-error/10 border-error/20',
      text: 'text-error',
    },
  ]

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">Booking Protection</p>
        <p className="font-display text-lg font-bold text-on-surface mt-1">Cancellation Policy</p>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.condition} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${row.bar}`}>
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${row.dot}`} />
            <div className="flex-1 text-sm text-on-surface-variant">
              <strong className="text-on-surface">{row.condition}:</strong> {row.refund}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-on-surface-variant/60">
        Violations of house rules may result in forfeiture of the security deposit.
      </p>
    </section>
  )
}
