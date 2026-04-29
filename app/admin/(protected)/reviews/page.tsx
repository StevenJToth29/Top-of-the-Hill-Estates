import { createServiceRoleClient } from '@/lib/supabase'
import ReviewsClient from '@/components/admin/ReviewsClient'

export const dynamic = 'force-dynamic'

export default async function AdminReviewsPage() {
  const supabase = createServiceRoleClient()

  const { data: reviews } = await supabase
    .from('reviews')
    .select(
      'id, rating, comment, approved, created_at, booking:bookings(guest_first_name, guest_last_name, room:rooms(name))',
    )
    .order('created_at', { ascending: false })

  return <ReviewsClient reviews={(reviews ?? []) as unknown as Parameters<typeof ReviewsClient>[0]['reviews']} />
}
