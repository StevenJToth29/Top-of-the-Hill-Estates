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
      application:booking_applications(id, submitted_at, decision, reviewed_at, purpose_of_stay, traveling_from, shared_living_exp, house_rules_confirmed, additional_info),
      guest_id_documents(id, guest_index, guest_name, current_address, id_photo_url, ai_quality_result, ai_authenticity_flag, ai_validation_notes)
    `)
    .eq('status', 'under_review')
    .order('application_deadline', { ascending: true })

  if (error) {
    console.error('GET /api/admin/applications error:', error)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }

  // Supabase returns booking_applications as an array (one-to-many FK); normalize to single object.
  // Also generate signed URLs for ID photos server-side using the service role client.
  const applications = await Promise.all(
    (data ?? []).map(async (row) => {
      const docsWithUrls = await Promise.all(
        (row.guest_id_documents ?? []).map(async (doc) => {
          if (!doc.id_photo_url) return { ...doc, id_photo_signed_url: null }
          const { data: urlData } = await supabase.storage
            .from('id-documents')
            .createSignedUrl(doc.id_photo_url, 3600)
          return { ...doc, id_photo_signed_url: urlData?.signedUrl ?? null }
        })
      )
      return {
        ...row,
        application: Array.isArray(row.application)
          ? (row.application[0] ?? null)
          : row.application,
        guest_id_documents: docsWithUrls,
      }
    })
  )

  return NextResponse.json({ applications })
}
