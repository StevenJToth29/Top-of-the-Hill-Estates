import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const serverClient = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await serverClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { status: string }
    const { status } = body

    const allowed = ['confirmed', 'cancelled', 'pending'] as const
    if (!status || !(allowed as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id')
      .eq('id', params.id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', params.id)

    if (updateError) {
      console.error('Failed to update booking status:', updateError)
      return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`PATCH /api/admin/bookings/${params.id}/status error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
