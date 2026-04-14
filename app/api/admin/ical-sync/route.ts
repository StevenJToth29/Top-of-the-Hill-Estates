import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { parseICalUrl } from '@/lib/ical'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const body = await request.json().catch(() => ({}))
  const roomId: string | undefined = body.room_id

  let query = supabase.from('ical_sources').select('*').eq('is_active', true)
  if (roomId) query = query.eq('room_id', roomId)

  const { data: sources, error: sourcesError } = await query
  if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 })
  if (!sources || sources.length === 0) return NextResponse.json({ synced: 0 })

  const now = new Date().toISOString()

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const events = await parseICalUrl(source.ical_url)

      if (events.length > 0) {
        await supabase.from('ical_blocks').upsert(
          events.map((event) => ({
            room_id: source.room_id,
            ical_source_url: source.ical_url,
            platform: source.platform,
            event_uid: event.uid,
            summary: event.summary,
            start_date: event.start.toISOString().split('T')[0],
            end_date: event.end.toISOString().split('T')[0],
            last_synced_at: now,
          })),
          { onConflict: 'event_uid' },
        )
      }

      await supabase
        .from('ical_sources')
        .update({ last_synced_at: now })
        .eq('id', source.id)
    }),
  )

  const errors: string[] = []
  let synced = 0
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      synced++
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason)
      errors.push(`Source ${sources[i].id}: ${msg}`)
    }
  })

  return NextResponse.json({ synced, errors: errors.length > 0 ? errors : undefined })
}
