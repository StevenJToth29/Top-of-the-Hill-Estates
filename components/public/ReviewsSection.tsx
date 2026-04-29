interface Review {
  id: string
  rating: number
  comment: string | null
  booking: {
    guest_first_name: string
    guest_last_name: string
  } | null
}

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < count ? 'text-primary' : 'text-surface-high'}`}
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

export default function ReviewsSection({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null

  return (
    <section className="bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">
            What Our Guests Say
          </p>
          <h2 className="font-display font-extrabold text-on-surface text-3xl leading-tight">
            Why Choose Us?
          </h2>
          <p className="text-on-surface-variant font-body mt-2">
            We provide more than just a room — a community lifestyle designed for modern living.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-surface-lowest rounded-2xl p-6 border border-surface flex flex-col gap-4"
            >
              <StarRating count={review.rating} />
              {review.comment && (
                <blockquote className="text-on-surface-variant font-body text-sm leading-relaxed flex-1">
                  &ldquo;{review.comment}&rdquo;
                </blockquote>
              )}
              <p className="font-display font-semibold text-on-surface text-sm">
                — {review.booking?.guest_first_name} {review.booking?.guest_last_name?.charAt(0)}.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
