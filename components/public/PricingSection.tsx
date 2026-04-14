interface Props {
  nightlyRate: number
  monthlyRate: number
  minNightsShortTerm: number
  minNightsLongTerm: number
}

export default function PricingSection({
  nightlyRate,
  monthlyRate,
  minNightsShortTerm,
  minNightsLongTerm,
}: Props) {
  return (
    <div className="bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-5 space-y-4">
      <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">Pricing</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container rounded-xl p-4 space-y-1">
          <p className="text-xs text-on-surface-variant">Short-term</p>
          <p className="font-display text-2xl font-bold text-on-surface">
            ${nightlyRate.toLocaleString()}
            <span className="text-sm font-normal text-on-surface-variant">/night</span>
          </p>
          <p className="text-xs text-on-surface-variant">
            Min. {minNightsShortTerm} night{minNightsShortTerm !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-surface-container rounded-xl p-4 space-y-1">
          <p className="text-xs text-on-surface-variant">Long-term</p>
          <p className="font-display text-2xl font-bold text-on-surface">
            ${monthlyRate.toLocaleString()}
            <span className="text-sm font-normal text-on-surface-variant">/month</span>
          </p>
          <p className="text-xs text-on-surface-variant">
            Min. {minNightsLongTerm} days
          </p>
        </div>
      </div>
    </div>
  )
}
