interface StatCardProps {
  label: string
  value: string
  delta?: number
  deltaUnit?: string
  sub?: string
  accent: string
}

function StatCard({ label, value, delta, deltaUnit = '%', sub, accent }: StatCardProps) {
  const isUp = delta !== undefined && delta > 0
  const isDown = delta !== undefined && delta < 0
  const deltaColor = isUp ? '#059669' : isDown ? '#DC2626' : '#94A3B8'

  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-white shadow-sm"
      style={{ borderColor: '#E2E8F0' }}
    >
      <div
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl"
        style={{ background: accent }}
      />
      <div className="px-5 py-[18px] pl-6">
        <p
          className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em]"
          style={{ color: '#94A3B8' }}
        >
          {label}
        </p>
        <p
          className="font-display text-[26px] font-[800] leading-none"
          style={{ color: '#0F172A' }}
        >
          {value}
        </p>
        {(delta !== undefined || sub) && (
          <div className="mt-[6px] flex flex-wrap items-center gap-1.5">
            {delta !== undefined && (
              <span className="text-xs font-bold" style={{ color: deltaColor }}>
                {isUp ? '▲' : isDown ? '▼' : '–'} {Math.abs(delta)}{deltaUnit}
              </span>
            )}
            {sub && (
              <span className="text-xs" style={{ color: '#94A3B8' }}>
                {sub}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface DashboardStatsProps {
  thisMonthRevenue: number
  revenueDelta: number
  occupancyPercent: number
  occupancyDelta: number
  upcomingCheckinsCount: number
  pendingCount: number
  outstandingBalance: number
  avgNightlyRate: number
}

export default function DashboardStats({
  thisMonthRevenue,
  revenueDelta,
  occupancyPercent,
  occupancyDelta,
  upcomingCheckinsCount,
  pendingCount,
  outstandingBalance,
  avgNightlyRate,
}: DashboardStatsProps) {
  const fmt$ = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
      <StatCard
        label="Revenue This Month"
        value={fmt$(thisMonthRevenue)}
        delta={revenueDelta}
        deltaUnit="%"
        sub="vs last month"
        accent="#2DD4BF"
      />
      <StatCard
        label="Occupancy Rate"
        value={`${occupancyPercent}%`}
        delta={occupancyDelta}
        deltaUnit="pp"
        sub="vs last month"
        accent="#7C3AED"
      />
      <StatCard
        label="Upcoming Check-ins"
        value={upcomingCheckinsCount.toString()}
        sub="confirmed bookings"
        accent="#059669"
      />
      <StatCard
        label="Pending Bookings"
        value={pendingCount.toString()}
        sub="needs confirmation"
        accent="#D97706"
      />
      <StatCard
        label="Outstanding Balance"
        value={fmt$(outstandingBalance)}
        sub="pending bookings"
        accent="#DC2626"
      />
      <StatCard
        label="Avg Nightly Rate"
        value={`$${avgNightlyRate}`}
        sub="across all rooms"
        accent="#64748B"
      />
    </div>
  )
}
