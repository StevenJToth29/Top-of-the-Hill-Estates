import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  // Fetch source first so we can cascade-delete blocks by URL
  const { data: source, error: fetchError } = await supabase
    .from('ical_sources')
    .select('ical_url')
    .eq('id', params.id)
    .single()

  if (fetchError || !source) {
    return NextResponse.json({ error: fetchError?.message ?? 'Source not found' }, { status: 404 })
  }

  // Delete all ical_blocks imported from this feed
  const { error: blocksError } = await supabase
    .from('ical_blocks')
    .delete()
    .eq('ical_source_url', source.ical_url)

  if (blocksError) return NextResponse.json({ error: blocksError.message }, { status: 500 })

  // Delete the source itself
  const { error } = await supabase
    .from('ical_sources')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
