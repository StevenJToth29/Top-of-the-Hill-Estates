import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { parseICalUrl } from '@/lib/ical'
import { format } from 'date-fns'

export async function POST(request: NextRequest) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { source_id } = body

    if (!source_id) {
      return NextResponse.json({ error: 'Missing source_id' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: source, error: sourceError } = await supabase
      .from('ical_sources')
      .select('*')
      .eq('id', source_id)
      .single()

    if (sourceError || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }

    const events = await parseICalUrl(source.ical_url)
    const syncedAt = new Date().toISOString()
    const validEvents = events.filter((e) => e.uid && e.start && e.end)

    if (validEvents.length > 0) {
      const { error: upsertError } = await supabase.from('ical_blocks').upsert(
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

      if (upsertError) throw new Error(upsertError.message)
    }

    await supabase
      .from('ical_sources')
      .update({ last_synced_at: syncedAt })
      .eq('id', source_id)

    return NextResponse.json({ success: true, synced: validEvents.length, synced_at: syncedAt })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
