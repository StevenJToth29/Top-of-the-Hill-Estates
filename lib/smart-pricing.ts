// Pure pricing engine — no I/O, fully testable

export type Aggressiveness = 'conservative' | 'moderate' | 'aggressive'

const AGGRESSIVENESS_MULTIPLIER: Record<Aggressiveness, number> = {
  conservative: 0.5,
  moderate: 1.0,
  aggressive: 1.5,
}

export interface SmartPriceInput {
  date: string           // YYYY-MM-DD
  today: string          // YYYY-MM-DD
  baseRate: number
  priceMin: number
  priceMax: number
  aggressiveness: Aggressiveness
  occupiedDates: Set<string>   // bookings + ical blocks in ±7 day window
  trendScore: number           // 0–100 (Google Trends interest); 50 = neutral
}

export function computeSmartPrice(opts: SmartPriceInput): number {
  const { date, today, baseRate, priceMin, priceMax, aggressiveness, occupiedDates, trendScore } = opts

  const dateObj = new Date(date + 'T00:00:00')
  const todayObj = new Date(today + 'T00:00:00')
  const dayOfWeek = dateObj.getDay() // 0=Sun…6=Sat
  const daysAhead = Math.round((dateObj.getTime() - todayObj.getTime()) / 86_400_000)

  let totalAdj = 0

  // Weekend premium (Fri=5, Sat=6)
  if (dayOfWeek === 5 || dayOfWeek === 6) totalAdj += 0.15
  // Thursday lift
  if (dayOfWeek === 4) totalAdj += 0.05
  // Near-term scarcity (0–7 days)
  if (daysAhead >= 0 && daysAhead <= 7) totalAdj += 0.10

  // Local occupancy signal: count occupied days in ±7 window
  let windowOccupied = 0
  let windowSize = 0
  for (let delta = -7; delta <= 7; delta++) {
    if (delta === 0) continue
    const d = new Date(dateObj.getTime() + delta * 86_400_000)
    const ds = d.toISOString().slice(0, 10)
    windowSize++
    if (occupiedDates.has(ds)) windowOccupied++
  }
  const occupancyRate = windowSize > 0 ? windowOccupied / windowSize : 0
  if (occupancyRate > 0.6) totalAdj += 0.10
  else if (occupancyRate < 0.15) totalAdj -= 0.08

  // Gap fill: isolated 1–2 night gap between blocked/booked dates
  const prev1 = new Date(dateObj.getTime() - 86_400_000).toISOString().slice(0, 10)
  const prev2 = new Date(dateObj.getTime() - 2 * 86_400_000).toISOString().slice(0, 10)
  const next1 = new Date(dateObj.getTime() + 86_400_000).toISOString().slice(0, 10)
  const next2 = new Date(dateObj.getTime() + 2 * 86_400_000).toISOString().slice(0, 10)
  const isGap1 = occupiedDates.has(prev1) && occupiedDates.has(next1)
  const isGap2 = !occupiedDates.has(prev1) && occupiedDates.has(prev2) && !occupiedDates.has(next1) && occupiedDates.has(next2)
  if (isGap1 || isGap2) totalAdj -= 0.10

  // Google Trends signal
  if (trendScore > 85) totalAdj += 0.10
  else if (trendScore > 70) totalAdj += 0.05
  else if (trendScore < 30) totalAdj -= 0.05

  const multiplier = AGGRESSIVENESS_MULTIPLIER[aggressiveness]

  // Clamp base into the configured range so the neutral price sits inside [priceMin, priceMax].
  const clampedBase = Math.max(priceMin, Math.min(priceMax, baseRate))

  // Normalize totalAdj to a [-1, +1] range-signal using the theoretical max adjustments,
  // then scale by aggressiveness. This maps demand signals directly onto the available price
  // range rather than as a percentage of baseRate, so the engine can leverage the full range.
  // MAX_ADJ_UP  = 0.15+0.10+0.10+0.10 = 0.45 (all positive signals, multiplier=1)
  // MAX_ADJ_DOWN = 0.08+0.10+0.05 = 0.23 (all negative signals, multiplier=1; advance discount removed)
  const MAX_ADJ_UP = 0.45
  const MAX_ADJ_DOWN = 0.23
  const rawSignal = totalAdj >= 0
    ? (totalAdj / MAX_ADJ_UP) * multiplier
    : (totalAdj / MAX_ADJ_DOWN) * multiplier
  const signal = Math.max(-1, Math.min(1, rawSignal))

  // signal=0 → clampedBase; signal=+1 → priceMax; signal=-1 → priceMin
  const adjusted = signal >= 0
    ? clampedBase + signal * (priceMax - clampedBase)
    : clampedBase + signal * (clampedBase - priceMin)

  return Math.max(priceMin, Math.min(priceMax, Math.round(adjusted)))
}
