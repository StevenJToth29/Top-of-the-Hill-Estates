import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { timingSafeCompare } from '@/lib/timing-safe-compare'
import { fetchTrendScore, deriveGeo, runSmartPricingForRoom, type SmartPricingRoomRow } from '@/lib/smart-pricing-runner'

export async function POST(request: NextRequest) {
  if (!timingSafeCompare(request.headers.get('Authorization') ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('id, nightly_rate, price_min, price_max, smart_pricing_aggressiveness, property:properties(city, state, trends_keyword, trends_geo)')
    .eq('smart_pricing_enabled', true)
    .not('price_min', 'is', null)
    .not('price_max', 'is', null)

  if (roomsError) {
    return NextResponse.json({ error: roomsError.message }, { status: 500 })
  }

  if (!rooms || rooms.length === 0) {
    return NextResponse.json({ rooms_processed: 0, dates_updated: 0, trends_fetched: 0 })
  }

  // Fetch trend scores per unique city (cache per run)
  const trendCache = new Map<string, number>()
  let trendsFetched = 0

  for (const room of rooms) {
    const prop = Array.isArray(room.property) ? room.property[0] : room.property
    if (!prop?.city) continue
    const cacheKey = prop.city.toLowerCase()
    if (trendCache.has(cacheKey)) continue
    const keyword: string = prop.trends_keyword ?? `${prop.city} vacation rental`
    const geo: string = prop.trends_geo ?? deriveGeo(prop.state ?? '')
    trendCache.set(cacheKey, await fetchTrendScore(keyword, geo))
    trendsFetched++
  }

  let totalDatesUpdated = 0
  for (const room of rooms) {
    const prop = Array.isArray(room.property) ? room.property[0] : room.property
    const trendScore = trendCache.get((prop?.city ?? '').toLowerCase()) ?? 50
    totalDatesUpdated += await runSmartPricingForRoom(supabase, room as unknown as SmartPricingRoomRow, trendScore)
  }

  return NextResponse.json({
    rooms_processed: rooms.length,
    dates_updated: totalDatesUpdated,
    trends_fetched: trendsFetched,
  })
}
