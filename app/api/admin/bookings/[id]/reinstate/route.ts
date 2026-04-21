import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const serverClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await serverClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', params.id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status !== 'cancelled') {
      return NextResponse.json({ error: 'Only cancelled bookings can be reinstated' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'pending',
        cancellation_reason: null,
        cancelled_at: null,
        refund_amount: null,
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Failed to reinstate booking:', updateError)
      return NextResponse.json({ error: 'Failed to reinstate booking' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`POST /api/admin/bookings/${params.id}/reinstate error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
