import { redirect } from 'next/navigation'

export default function AdminReviewsPage() {
  redirect('/admin/bookings?tab=reviews')
}
