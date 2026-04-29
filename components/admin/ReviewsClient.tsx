'use client'

import { useState } from 'react'

interface ReviewRow {
  id: string
  rating: number
  comment: string | null
  approved: boolean
  created_at: string
  booking: {
    guest_first_name: string
    guest_last_name: string
    room: { name: string } | null
  } | null
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`h-4 w-4 ${s <= count ? 'text-primary' : 'text-surface-high'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.958z" />
        </svg>
      ))}
    </div>
  )
}

export default function ReviewsClient({ reviews: initial }: { reviews: ReviewRow[] }) {
  const [reviews, setReviews] = useState(initial)

  async function toggleApprove(id: string, current: boolean) {
    await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: !current }),
    })
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, approved: !r.approved } : r)))
  }

  async function deleteReview(id: string) {
    await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' })
    setReviews((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: '#64748B' }}>
        Approve guest reviews before they appear on your homepage
      </p>

      {reviews.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              style={{
                background: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '16px',
              }}
              className="flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Stars count={review.rating} />
                  <span className="text-xs text-on-surface-variant">
                    {review.booking?.guest_first_name} {review.booking?.guest_last_name}
                    {review.booking?.room ? ` · ${review.booking.room.name}` : ''}
                  </span>
                  <span
                    style={{
                      background: review.approved ? 'rgba(5,150,105,0.08)' : 'rgba(217,119,6,0.08)',
                      color: review.approved ? '#059669' : '#D97706',
                      border: `1px solid ${review.approved ? 'rgba(5,150,105,0.2)' : 'rgba(217,119,6,0.2)'}`,
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {review.approved ? 'Approved' : 'Pending'}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-on-surface-variant mt-1">&ldquo;{review.comment}&rdquo;</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleApprove(review.id, review.approved)}
                  style={{
                    background: review.approved ? '#FEF2F2' : 'rgba(5,150,105,0.08)',
                    color: review.approved ? '#DC2626' : '#059669',
                    border: `1px solid ${review.approved ? 'rgba(220,38,38,0.2)' : 'rgba(5,150,105,0.2)'}`,
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {review.approved ? 'Unapprove' : 'Approve'}
                </button>
                <button
                  onClick={() => deleteReview(review.id)}
                  style={{
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid rgba(220,38,38,0.2)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
