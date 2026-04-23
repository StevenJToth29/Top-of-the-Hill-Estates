interface Props {
  nightlyRate: number
  monthlyRate: number
  minNightsShortTerm: number
  minNightsLongTerm: number
  cleaningFee?: number
  showNightlyRate?: boolean
  showMonthlyRate?: boolean
}

export default function PricingSection({
  nightlyRate,
  monthlyRate,
  minNightsShortTerm,
  minNightsLongTerm,
  cleaningFee,
  showNightlyRate = true,
  showMonthlyRate = true,
}: Props) {
  if (!showNightlyRate && !showMonthlyRate) return null

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">Rates</p>
        <p className="font-display text-lg font-bold text-on-surface mt-1">Pricing Options</p>
      </div>
      <div className={`grid gap-3 ${showNightlyRate && showMonthlyRate ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {showNightlyRate && (
          <div className="p-4 rounded-xl border border-outline-variant/20 bg-surface-highest/40 space-y-1.5">
            <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">Short-term</p>
            <p className="font-display text-2xl font-bold text-on-surface">
              Variable
              <span className="text-sm font-normal text-on-surface-variant"> /night</span>
            </p>
            <p className="text-xs text-on-surface-variant">
              Min. {minNightsShortTerm} night{minNightsShortTerm !== 1 ? 's' : ''} · Rate set by calendar
            </p>
            {cleaningFee ? (
              <span className="inline-block mt-1 px-2.5 py-1 rounded-lg bg-secondary/10 text-xs font-bold text-secondary">
                Cleaning fee: ${cleaningFee}
              </span>
            ) : null}
          </div>
        )}
        {showMonthlyRate && (
          <div className="relative p-4 rounded-xl border border-secondary/40 bg-secondary/5 space-y-1.5 overflow-hidden">
            <span className="absolute top-2.5 right-2.5 bg-secondary text-background text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide">
              Best Value
            </span>
            <p className="text-xs uppercase tracking-widest text-secondary font-body">Long-term</p>
            <p className="font-display text-2xl font-bold text-on-surface">
              ${monthlyRate.toLocaleString()}
              <span className="text-sm font-normal text-on-surface-variant"> /month</span>
            </p>
            <p className="text-xs text-on-surface-variant">
              Min. {minNightsLongTerm} days · Deposit required
            </p>
            <span className="inline-block mt-1 px-2.5 py-1 rounded-lg bg-secondary/15 text-xs font-bold text-secondary">
              All utilities included
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
