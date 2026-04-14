import { createServiceRoleClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('ical_sources')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
