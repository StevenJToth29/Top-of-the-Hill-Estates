import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; reqId: string } },
) {
  try {
    const serverClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await serverClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { action?: string; admin_note?: string }
    const { action, admin_note } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: modRequest, error: fetchError } = await supabase
      .from('booking_modification_requests')
      .select('*')
      .eq('id', params.reqId)
      .eq('booking_id', params.id)
      .single()

    if (fetchError || !modRequest) {
      return NextResponse.json({ error: 'Modification request not found' }, { status: 404 })
    }

    if (modRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Modification request is no longer pending' }, { status: 400 })
    }

    // Update request status first — easier to roll back than a booking change
    const { error: reqUpdateError } = await supabase
      .from('booking_modification_requests')
      .update({ status: action === 'approve' ? 'approved' : 'rejected', admin_note: admin_note ?? null })
      .eq('id', params.reqId)

    if (reqUpdateError) {
      console.error('Failed to update modification request:', reqUpdateError)
      return NextResponse.json({ error: 'Failed to update modification request' }, { status: 500 })
    }

    if (action === 'approve') {
      const { data: currentBooking } = await supabase
        .from('bookings')
        .select('total_amount')
        .eq('id', params.id)
        .single()

      const { error: bookingUpdateError } = await supabase
        .from('bookings')
        .update({
          check_in: modRequest.requested_check_in,
          check_out: modRequest.requested_check_out,
          total_nights: modRequest.requested_total_nights,
          guest_count: modRequest.requested_guest_count,
          ...(modRequest.price_delta != null && currentBooking
            ? { total_amount: Math.round((currentBooking.total_amount + modRequest.price_delta) * 100) / 100 }
            : {}),
        })
        .eq('id', params.id)

      if (bookingUpdateError) {
        console.error('Failed to update booking on approve:', bookingUpdateError)
        // Roll back the request status so admin can retry
        await supabase
          .from('booking_modification_requests')
          .update({ status: 'pending', admin_note: null })
          .eq('id', params.reqId)
        return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(
      `PATCH /api/admin/bookings/${params.id}/modification-requests/${params.reqId} error:`,
      err,
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
