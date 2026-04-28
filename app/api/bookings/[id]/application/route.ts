import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { evaluateAndQueueEmails } from '@/lib/email-queue'
import type { BookingApplication } from '@/types'

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id: bookingId } = await params
  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, guest_count, guest_email, guest_first_name, guest_last_name')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!['pending_docs', 'under_review'].includes(booking.status)) {
    return NextResponse.json({ error: 'Application not available for this booking' }, { status: 403 })
  }

  const { data: application } = await supabase
    .from('booking_applications')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle()

  const { data: guestDocs } = await supabase
    .from('guest_id_documents')
    .select('*')
    .eq('booking_id', bookingId)
    .order('guest_index')

  return NextResponse.json({ booking, application: application ?? null, guestDocs: guestDocs ?? [] })
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id: bookingId } = await params
  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, guest_count')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status !== 'pending_docs') {
    return NextResponse.json({ error: 'Application cannot be started for this booking' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('booking_applications')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ application: existing })
  }

  const { data: application, error } = await supabase
    .from('booking_applications')
    .insert({ booking_id: bookingId })
    .select()
    .single()

  if (error) {
    console.error('application POST: insert error:', error)
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 })
  }

  return NextResponse.json({ application })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id: bookingId } = await params
  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, guest_count')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status !== 'pending_docs') {
    return NextResponse.json({ error: 'Application already submitted or expired' }, { status: 400 })
  }

  const body = await req.json() as Partial<BookingApplication> & {
    submit?: boolean
    guest_address_street?: string
    guest_address_city?: string
    guest_address_state?: string
    guest_address_zip?: string
  }

  // Save address fields directly to the booking record
  const addressUpdate: Record<string, unknown> = {}
  if (body.guest_address_street !== undefined) addressUpdate.guest_address_street = body.guest_address_street
  if (body.guest_address_city !== undefined) addressUpdate.guest_address_city = body.guest_address_city
  if (body.guest_address_state !== undefined) addressUpdate.guest_address_state = body.guest_address_state
  if (body.guest_address_zip !== undefined) addressUpdate.guest_address_zip = body.guest_address_zip

  if (Object.keys(addressUpdate).length > 0) {
    await supabase
      .from('bookings')
      .update({ ...addressUpdate, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
  }

  const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.purpose_of_stay !== undefined) updateFields.purpose_of_stay = body.purpose_of_stay
  if (body.traveling_from !== undefined) updateFields.traveling_from = body.traveling_from
  if (body.shared_living_exp !== undefined) updateFields.shared_living_exp = body.shared_living_exp
  if (body.house_rules_confirmed !== undefined) updateFields.house_rules_confirmed = body.house_rules_confirmed
  if (body.additional_info !== undefined) updateFields.additional_info = body.additional_info

  if (body.submit === true) {
    const { data: app } = await supabase
      .from('booking_applications')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (!app) {
      return NextResponse.json({ error: 'Application not found — start the application first' }, { status: 422 })
    }

    const { data: docs } = await supabase
      .from('guest_id_documents')
      .select('id, ai_quality_result')
      .eq('booking_id', bookingId)

    const expectedDocs = booking.guest_count ?? 1
    const passedDocs = (docs ?? []).filter((d) => d.ai_quality_result === 'pass')

    if (passedDocs.length < expectedDocs) {
      return NextResponse.json(
        { error: `All ${expectedDocs} guest ID(s) must be uploaded and pass quality check` },
        { status: 422 }
      )
    }

    const merged = { ...app, ...updateFields }
    if (!merged.purpose_of_stay || !merged.traveling_from || !merged.shared_living_exp || !merged.house_rules_confirmed) {
      return NextResponse.json({ error: 'All screening questions must be answered' }, { status: 422 })
    }

    updateFields.submitted_at = new Date().toISOString()

    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('bookings')
      .update({ status: 'under_review', application_deadline: deadline, updated_at: new Date().toISOString() })
      .eq('id', bookingId)

    evaluateAndQueueEmails('admin_application_submitted', { type: 'booking', bookingId }).catch(
      (err) => { console.error('email queue error on admin_application_submitted:', err) }
    )
    evaluateAndQueueEmails('application_reminder_24h', { type: 'booking', bookingId }).catch(console.error)
    evaluateAndQueueEmails('application_reminder_12h', { type: 'booking', bookingId }).catch(console.error)
  }

  const { data: updated, error: updateError } = await supabase
    .from('booking_applications')
    .update(updateFields)
    .eq('booking_id', bookingId)
    .select()
    .single()

  if (updateError) {
    console.error('application PATCH: update error:', updateError)
    return NextResponse.json({ error: 'Failed to save application' }, { status: 500 })
  }

  return NextResponse.json({ application: updated, submitted: body.submit === true })
}
