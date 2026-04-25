import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

export async function GET() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, status, check_in, check_out, guest_count, guest_first_name, guest_last_name,
      guest_email, total_amount, application_deadline, stripe_payment_intent_id,
      room:rooms(name, property:properties(name)),
      application:booking_applications(id, submitted_at, decision, reviewed_at),
      guest_id_documents(id, guest_index, ai_quality_result, ai_authenticity_flag)
    `)
    .eq('status', 'under_review')
    .order('application_deadline', { ascending: true })

  if (error) {
    console.error('GET /api/admin/applications error:', error)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }

  return NextResponse.json({ applications: data ?? [] })
}
