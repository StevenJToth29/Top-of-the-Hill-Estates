import { createServiceRoleClient } from '@/lib/supabase'
import { computeSmartPrice } from '@/lib/smart-pricing'
import type { Aggressiveness } from '@/lib/smart-pricing'
import type { SupabaseClient } from '@supabase/supabase-js'

// google-trends-api has no TS types
// eslint-disable-next-line @typescript-eslint/no-require-imports
const googleTrends = require('google-trends-api')

export const SMART_PRICING_DAYS_AHEAD = 120

export async function fetchTrendScore(keyword: string, geo: string): Promise<number> {
  try {
    const json = await googleTrends.interestOverTime({
      keyword,
      geo,
      startTime: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000),
    })
    const parsed = JSON.parse(json)
    const timeline: { value: number[] }[] = parsed?.default?.timelineData ?? []
    if (timeline.length === 0) return 50
    const values = timeline.map((t) => t.value[0] ?? 0).filter((v) => v > 0)
    if (values.length === 0) return 50
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  } catch {
    return 50
  }
}

export function deriveGeo(state: string): string {
  return state ? `US-${state.trim().toUpperCase()}` : 'US'
}

export interface SmartPricingRoomRow {
  id: string
  nightly_rate: number
  price_min: number
  price_max: number
  smart_pricing_aggressiveness: string | null
  property: { city: string; state: string; trends_keyword: string | null; trends_geo: string | null } | null
}

export async function runSmartPricingForRoom(
  supabase: SupabaseClient,
  room: SmartPricingRoomRow,
  trendScore: number,
): Promise<number> {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const windowStart = todayStr
  const windowEnd = new Date(today.getTime() + SMART_PRICING_DAYS_AHEAD * 86_400_000).toISOString().slice(0, 10)

  const aggressiveness = (room.smart_pricing_aggressiveness ?? 'moderate') as Aggressiveness

  const [{ data: bookings }, { data: icalBlocks }, { data: existingOverrides }] = await Promise.all([
    supabase
      .from('bookings')
      .select('check_in, check_out')
      .eq('room_id', room.id)
      .in('status', ['confirmed', 'pending', 'pending_docs', 'under_review'])
      .lt('check_in', windowEnd)
      .gt('check_out', windowStart),
    supabase
      .from('ical_blocks')
      .select('start_date, end_date')
      .eq('room_id', room.id)
      .lt('start_date', windowEnd)
      .gt('end_date', windowStart),
    supabase
      .from('date_overrides')
      .select('date, price_override, source')
      .eq('room_id', room.id)
      .gte('date', windowStart)
      .lte('date', windowEnd),
  ])

  const occupiedDates = new Set<string>()
  for (const b of bookings ?? []) {
    let d = new Date(b.check_in + 'T00:00:00')
    const end = new Date(b.check_out + 'T00:00:00')
    while (d < end) {
      occupiedDates.add(d.toISOString().slice(0, 10))
      d = new Date(d.getTime() + 86_400_000)
    }
  }
  for (const b of icalBlocks ?? []) {
    let d = new Date(b.start_date + 'T00:00:00')
    const end = new Date(b.end_date + 'T00:00:00')
    while (d < end) {
      occupiedDates.add(d.toISOString().slice(0, 10))
      d = new Date(d.getTime() + 86_400_000)
    }
  }

  const manualDates = new Set<string>()
  const smartPriceByDate = new Map<string, number | null>()
  for (const o of existingOverrides ?? []) {
    if (o.source === 'manual') manualDates.add(o.date)
    else smartPriceByDate.set(o.date, o.price_override)
  }

  const upsertRows: { room_id: string; date: string; price_override: number; is_blocked: boolean; source: string }[] = []

  for (let i = 1; i <= SMART_PRICING_DAYS_AHEAD; i++) {
    const d = new Date(today.getTime() + i * 86_400_000)
    const ds = d.toISOString().slice(0, 10)
    if (manualDates.has(ds)) continue

    const smartPrice = computeSmartPrice({
      date: ds,
      today: todayStr,
      baseRate: room.nightly_rate,
      priceMin: room.price_min,
      priceMax: room.price_max,
      aggressiveness,
      occupiedDates,
      trendScore,
    })

    if (smartPriceByDate.get(ds) !== smartPrice) {
      upsertRows.push({ room_id: room.id, date: ds, price_override: smartPrice, is_blocked: false, source: 'smart' })
    }
  }

  for (let i = 0; i < upsertRows.length; i += 100) {
    await supabase
      .from('date_overrides')
      .upsert(upsertRows.slice(i, i + 100), { onConflict: 'room_id,date' })
  }

  return upsertRows.length
}

export async function runSmartPricingForRoomById(roomId: string): Promise<number> {
  const supabase = createServiceRoleClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('id, nightly_rate, price_min, price_max, smart_pricing_aggressiveness, property:properties(city, state, trends_keyword, trends_geo)')
    .eq('id', roomId)
    .eq('smart_pricing_enabled', true)
    .not('price_min', 'is', null)
    .not('price_max', 'is', null)
    .maybeSingle()

  if (!room) return 0

  const prop = Array.isArray(room.property) ? room.property[0] : room.property
  const keyword: string = prop?.trends_keyword ?? `${prop?.city ?? ''} vacation rental`
  const geo: string = prop?.trends_geo ?? deriveGeo(prop?.state ?? '')
  const trendScore = await fetchTrendScore(keyword, geo)

  return runSmartPricingForRoom(supabase, room as unknown as SmartPricingRoomRow, trendScore)
}
