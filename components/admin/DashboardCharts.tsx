'use client'

const TEAL = '#2DD4BF'
const TEAL_DARK = '#1FB2A0'
const MUTED = '#94A3B8'
const TEXT = '#0F172A'

function fmt$(n: number) {
  if (n >= 1000) return '$' + Math.round(n / 100) / 10 + 'k'
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

interface MonthData {
  label: string
  revenue: number
  occupancyPercent: number
  isCurrent: boolean
}

function RevenueChart({ data }: { data: MonthData[] }) {
  const W = 480, H = 160, padL = 44, padB = 28, padT = 12, padR = 16
  const maxRev = Math.max(...data.map(d => d.revenue), 1)
  const bw = (W - padL - padR) / data.length
  const barW = bw * 0.52

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + padT + padB}`} style={{ overflow: 'visible' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(p => {
        const y = padT + H - p * H
        return (
          <g key={p}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#F1F5F9" strokeWidth={1} />
            <text x={padL - 6} y={y + 4} fontSize={9} textAnchor="end" fill={MUTED}>
              {fmt$(maxRev * p)}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const x = padL + i * bw + (bw - barW) / 2
        const bh = maxRev > 0 ? (d.revenue / maxRev) * H : 0
        const y = padT + H - bh
        return (
          <g key={i}>
            <rect
              x={x}
              y={bh > 0 ? y : padT + H - 1}
              width={barW}
              height={bh > 0 ? bh : 1}
              rx={4}
              fill={d.isCurrent ? TEAL : 'rgba(45,212,191,0.25)'}
            />
            {d.isCurrent && d.revenue > 0 && (
              <text
                x={x + barW / 2}
                y={y - 5}
                fontSize={10}
                fontWeight={700}
                textAnchor="middle"
                fill={TEAL_DARK}
              >
                {fmt$(d.revenue)}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={padT + H + padB - 6}
              fontSize={10}
              textAnchor="middle"
              fill={d.isCurrent ? TEAL_DARK : MUTED}
              fontWeight={d.isCurrent ? 700 : 400}
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function OccupancyChart({ data }: { data: MonthData[] }) {
  const W = 360, H = 140, padL = 36, padB = 28, padT = 16, padR = 12

  const pts = data.map((d, i) => {
    const x = padL + (i / (data.length - 1)) * (W - padL - padR)
    const y = padT + H - (d.occupancyPercent / 100) * H
    return [x, y] as [number, number]
  })

  const poly = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const area =
    `M${pts[0][0]},${padT + H} ` +
    pts.map(([x, y]) => `L${x},${y}`).join(' ') +
    ` L${pts[pts.length - 1][0]},${padT + H} Z`

  const curPct = data[data.length - 1].occupancyPercent

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + padT + padB}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="dashOccGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={TEAL} stopOpacity={0.18} />
          <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map(p => {
        const y = padT + H - (p / 100) * H
        return (
          <g key={p}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#F1F5F9" strokeWidth={1} />
            <text x={padL - 6} y={y + 4} fontSize={9} textAnchor="end" fill={MUTED}>
              {p}%
            </text>
          </g>
        )
      })}
      <path d={area} fill="url(#dashOccGrad)" />
      <polyline
        points={poly}
        fill="none"
        stroke={TEAL}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === data.length - 1 ? 5 : 3}
          fill={i === data.length - 1 ? TEAL : '#FFF'}
          stroke={TEAL}
          strokeWidth={2}
        />
      ))}
      {data.map((d, i) => (
        <text
          key={i}
          x={pts[i][0]}
          y={padT + H + padB - 6}
          fontSize={10}
          textAnchor="middle"
          fill={d.isCurrent ? TEAL_DARK : MUTED}
          fontWeight={d.isCurrent ? 700 : 400}
        >
          {d.label}
        </text>
      ))}
      <text
        x={pts[pts.length - 1][0]}
        y={pts[pts.length - 1][1] - 10}
        fontSize={11}
        fontWeight={800}
        textAnchor="middle"
        fill={TEAL_DARK}
      >
        {curPct}%
      </text>
    </svg>
  )
}

interface Props {
  monthlyData: MonthData[]
  currentRevenue: number
  revenueDelta: number
  currentOccupancy: number
  occupancyDelta: number
}

export default function DashboardCharts({
  monthlyData,
  currentRevenue,
  revenueDelta,
  currentOccupancy,
  occupancyDelta,
}: Props) {
  const fmt$Long = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr)' }}
    >
      {/* Revenue */}
      <div
        className="rounded-xl border bg-white p-5 shadow-sm"
        style={{ borderColor: '#E2E8F0' }}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="font-display text-[15px] font-[800]" style={{ color: TEXT }}>
              Revenue
            </p>
            <p className="mt-0.5 text-xs" style={{ color: MUTED }}>
              Last 6 months
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-[800]" style={{ color: TEAL_DARK }}>
              {fmt$Long(currentRevenue)}
            </p>
            <p
              className="mt-0.5 text-xs font-semibold"
              style={{ color: revenueDelta >= 0 ? '#059669' : '#DC2626' }}
            >
              {revenueDelta >= 0 ? '▲' : '▼'} {Math.abs(revenueDelta)}% vs last month
            </p>
          </div>
        </div>
        <RevenueChart data={monthlyData} />
      </div>

      {/* Occupancy */}
      <div
        className="rounded-xl border bg-white p-5 shadow-sm"
        style={{ borderColor: '#E2E8F0' }}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="font-display text-[15px] font-[800]" style={{ color: TEXT }}>
              Occupancy
            </p>
            <p className="mt-0.5 text-xs" style={{ color: MUTED }}>
              Last 6 months
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-[800]" style={{ color: TEAL_DARK }}>
              {currentOccupancy}%
            </p>
            <p
              className="mt-0.5 text-xs font-semibold"
              style={{ color: occupancyDelta >= 0 ? '#059669' : '#DC2626' }}
            >
              {occupancyDelta >= 0 ? '▲' : '▼'} {Math.abs(occupancyDelta)}pp vs last month
            </p>
          </div>
        </div>
        <OccupancyChart data={monthlyData} />
      </div>
    </div>
  )
}
