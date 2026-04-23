interface Props {
  nightlyRate: number
  monthlyRate?: number
  showNightly?: boolean
}

export default function MobileBookingBar({ nightlyRate, monthlyRate, showNightly = true }: Props) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-outline-variant/20 px-5 py-3 flex items-center gap-4 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
      <div>
        {showNightly && nightlyRate ? (
          <p className="text-base font-bold text-on-surface">
            ${nightlyRate}
            <span className="text-sm font-normal text-on-surface-variant"> /night</span>
          </p>
        ) : monthlyRate ? (
          <p className="text-base font-bold text-on-surface">
            ${monthlyRate.toLocaleString()}
            <span className="text-sm font-normal text-on-surface-variant"> /mo</span>
          </p>
        ) : null}
      </div>
      <a
        href="#booking-widget-anchor"
        className="flex-1 bg-secondary text-background font-bold text-sm rounded-xl py-3 hover:opacity-90 transition-opacity text-center"
      >
        Check Availability
      </a>
    </div>
  )
}
