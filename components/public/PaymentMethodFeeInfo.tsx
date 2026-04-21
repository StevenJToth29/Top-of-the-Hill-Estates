import type { PaymentMethodConfig } from '@/types'

function formatFee(percent: number, flat: number): string {
  const p = Number(percent)
  const f = Number(flat)
  if (p === 0 && f === 0) return 'No processing fee'
  if (p === 0) return `$${f.toFixed(2)} flat`
  if (f === 0) return `${p.toFixed(2)}%`
  return `${p.toFixed(2)}% + $${f.toFixed(2)}`
}

interface PaymentMethodFeeInfoProps {
  methods: PaymentMethodConfig[]
}

export default function PaymentMethodFeeInfo({ methods }: PaymentMethodFeeInfoProps) {
  if (methods.length === 0) return null

  return (
    <div className="bg-surface-highest/40 rounded-xl p-4 space-y-2">
      <h3 id="pmf-heading" className="text-on-surface-variant text-xs font-semibold uppercase tracking-wide">
        Payment Method Fees
      </h3>
      <ul aria-labelledby="pmf-heading" className="space-y-1">
        {methods.map((m) => (
          <li key={m.method_key} className="flex justify-between text-sm">
            <span className="text-on-surface-variant">{m.label}</span>
            <span className="text-on-surface">{formatFee(m.fee_percent, m.fee_flat)}</span>
          </li>
        ))}
      </ul>
      <p className="text-on-surface-variant/60 text-xs italic">
        Processing fee is applied when you confirm your payment method and is non-refundable.
      </p>
    </div>
  )
}
