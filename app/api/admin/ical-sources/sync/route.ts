import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source_id } = body

    if (!source_id) {
      return NextResponse.json({ error: 'Missing source_id' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const syncedAt = new Date().toISOString()

    const { error } = await supabase
      .from('ical_sources')
      .update({ last_synced_at: syncedAt })
      .eq('id', source_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, synced_at: syncedAt })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
