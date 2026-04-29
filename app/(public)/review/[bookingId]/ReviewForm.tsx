'use client'

import { useState } from 'react'

export default function ReviewForm({ bookingId, token }: { bookingId: string; token: string }) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) {
      setError('Please select a star rating.')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch(`/api/reviews/${bookingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment, token }),
    })
    if (res.ok) {
      setSubmitted(true)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <p className="font-display font-bold text-2xl text-on-surface mb-2">
          Thanks for your review!
        </p>
        <p className="text-on-surface-variant">
          Your feedback has been submitted and is pending approval.
        </p>
      </div>
    )
  }

  const activeStar = hovered || rating

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-on-surface mb-3">Your rating</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
            >
              <svg
                className="h-9 w-9 transition-colors"
                fill={activeStar >= star ? '#2DD4BF' : 'none'}
                stroke={activeStar >= star ? '#2DD4BF' : '#CBD5E1'}
                viewBox="0 0 20 20"
                aria-hidden
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.958z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="comment" className="block text-sm font-semibold text-on-surface mb-2">
          Comments <span className="font-normal text-on-surface-variant">(optional)</span>
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Tell us about your stay…"
          className="w-full rounded-lg border border-surface bg-surface-lowest px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary text-sm disabled:opacity-60"
      >
        {loading ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  )
}
