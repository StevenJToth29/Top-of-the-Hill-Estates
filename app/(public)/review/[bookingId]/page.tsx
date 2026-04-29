import { createServiceRoleClient } from '@/lib/supabase'
import { verifyReviewToken } from '@/lib/review-token'
import ReviewForm from './ReviewForm'

export const dynamic = 'force-dynamic'

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: { bookingId: string }
  searchParams: { token?: string }
}) {
  const { bookingId } = params
  const { token } = searchParams

  const isValidToken = !!token && verifyReviewToken(bookingId, token)

  if (!isValidToken) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-background">
        <p className="text-on-surface-variant text-sm">
          This review link is invalid or has expired.
        </p>
      </main>
    )
  }

  const supabase = createServiceRoleClient()

  const [{ data: booking }, { data: existingReview }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, guest_first_name, check_out, room:rooms(name)')
      .eq('id', bookingId)
      .single(),
    supabase.from('reviews').select('id').eq('booking_id', bookingId).maybeSingle(),
  ])

  const today = new Date().toISOString().split('T')[0]
  const isInvalid = !booking || booking.check_out > today

  if (isInvalid) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-background">
        <p className="text-on-surface-variant text-sm">
          This review link is invalid or not yet available.
        </p>
      </main>
    )
  }

  if (existingReview) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="text-center">
          <p className="font-display font-bold text-2xl text-on-surface mb-2">Already submitted!</p>
          <p className="text-on-surface-variant">Thank you for leaving a review.</p>
        </div>
      </main>
    )
  }

  const roomName = (booking.room as unknown as { name: string } | null)?.name ?? 'your room'

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-lg">
        <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Your Stay</p>
        <h1 className="font-display font-extrabold text-2xl text-on-surface mb-1">
          How was {roomName}?
        </h1>
        <p className="text-on-surface-variant mb-8">
          Hi {booking.guest_first_name}, we&apos;d love to hear about your experience.
        </p>
        <ReviewForm bookingId={bookingId} token={token} />
      </div>
    </main>
  )
}
