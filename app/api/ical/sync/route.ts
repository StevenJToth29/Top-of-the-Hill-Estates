import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { parseICalUrl } from '@/lib/ical'
import { format } from 'date-fns'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET ?? ''

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  const { data: sources } = await supabase
    .from('ical_sources')
    .select('*')
    .eq('is_active', true)

  if (!sources || sources.length === 0) {
    return Response.json({ synced: 0, errors: [] })
  }

  const results = { synced: 0, errors: [] as string[] }

  await Promise.all(
    sources.map(async (source) => {
      try {
        const events = await parseICalUrl(source.ical_url)
        const syncedAt = new Date().toISOString()

        const validEvents = events.filter((e) => e.uid && e.start && e.end)

        if (validEvents.length > 0) {
          const { error } = await supabase.from('ical_blocks').upsert(
            validEvents.map((event) => ({
              room_id: source.room_id,
              ical_source_url: source.ical_url,
              platform: source.platform,
              event_uid: event.uid,
              summary: event.summary,
              start_date: format(event.start, 'yyyy-MM-dd'),
              end_date: format(event.end, 'yyyy-MM-dd'),
              last_synced_at: syncedAt,
            })),
            { onConflict: 'room_id,event_uid', ignoreDuplicates: false },
          )

          if (error) throw new Error(error.message)
          results.synced += validEvents.length
        }

        await supabase
          .from('ical_sources')
          .update({ last_synced_at: syncedAt })
          .eq('id', source.id)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        results.errors.push(`Source ${source.id} (${source.platform}): ${message}`)
      }
    }),
  )

  return Response.json(results)
}
