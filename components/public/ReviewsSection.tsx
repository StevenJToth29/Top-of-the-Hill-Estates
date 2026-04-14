const reviews = [
  {
    id: 1,
    quote:
      'The room was immaculate and the location was perfect for my commute. Everything was furnished and ready to go from day one — I was settled in within an hour.',
    name: 'Marcus T.',
    stars: 5,
  },
  {
    id: 2,
    quote:
      'Booked directly through their site and saved a ton compared to other platforms. The team was responsive and made the whole process effortless.',
    name: 'Priya S.',
    stars: 5,
  },
  {
    id: 3,
    quote:
      'I stayed for three months while relocating for work. Having a furnished room with flexible terms made a stressful move so much easier.',
    name: 'Jordan L.',
    stars: 5,
  },
  {
    id: 4,
    quote:
      "Clean, quiet, and great value. The monthly rate is unbeatable for a fully furnished room in Tempe. I've already referred two colleagues.",
    name: 'Aisha R.',
    stars: 4,
  },
  {
    id: 5,
    quote:
      'No hidden fees, no platform markups. What you see is what you pay. Highly recommend booking direct with Top of the Hill Rooms.',
    name: 'Derek M.',
    stars: 5,
  },
]

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < count ? 'text-secondary' : 'text-on-surface-variant/20'}`}
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

export default function ReviewsSection() {
  return (
    <section className="bg-surface-low py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-widest text-secondary font-medium mb-3 text-center">
          What Our Guests Say
        </p>
        <h2 className="font-display font-bold text-primary text-4xl text-center mb-12 leading-tight">
          Stories from the Hill
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_40px_rgba(175,201,234,0.06)] flex flex-col gap-4"
            >
              <StarRating count={review.stars} />
              <blockquote className="text-on-surface-variant text-sm leading-relaxed flex-1">
                &ldquo;{review.quote}&rdquo;
              </blockquote>
              <p className="font-display font-semibold text-on-surface text-sm">— {review.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
