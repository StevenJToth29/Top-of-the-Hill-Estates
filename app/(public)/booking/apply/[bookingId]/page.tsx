import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase'
import ApplicationForm from '@/components/public/ApplicationForm'
import type { Booking, BookingApplication, GuestIdDocument } from '@/types'

interface PageProps {
  params: Promise<{ bookingId: string }>
  searchParams: Promise<{ email?: string }>
}

export const metadata = { title: 'Complete Your Application', robots: { index: false, follow: false } }

export default async function BookingApplyPage({ params, searchParams }: PageProps) {
  const { bookingId } = await params
  const { email } = await searchParams

  if (!email) redirect('/booking/manage')

  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, room:rooms(name, property:properties(name, house_rules))')
    .eq('id', bookingId)
    .ilike('guest_email', email)
    .maybeSingle()

  if (!booking) redirect('/booking/manage')

  if (!['pending_docs', 'under_review'].includes(booking.status)) {
    redirect(`/booking/manage?booking_id=${bookingId}&guest_email=${encodeURIComponent(email)}`)
  }

  await supabase
    .from('booking_applications')
    .upsert({ booking_id: bookingId }, { onConflict: 'booking_id', ignoreDuplicates: true })

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

  return (
    <main className="min-h-screen bg-background">
      <ApplicationForm
        booking={booking as Booking & { room: { name: string; property: { name: string; house_rules?: string | null } } }}
        application={(application as BookingApplication) ?? null}
        savedDocs={(guestDocs ?? []) as GuestIdDocument[]}
      />
    </main>
  )
}
