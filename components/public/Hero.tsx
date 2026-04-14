import Link from 'next/link'

export default function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-background to-surface px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 30%, rgba(175,201,234,0.18) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <p className="mb-4 text-xs uppercase tracking-widest text-secondary font-medium">
          Mesa &amp; Tempe, Arizona
        </p>
        <h1 className="font-display font-bold text-primary leading-tight mb-6" style={{ fontSize: 'clamp(2.25rem, 6vw, 3.75rem)' }}>
          Rooms That Feel Like Home, In the Heart of the Valley
        </h1>
        <p className="text-on-surface-variant text-xl mb-10 max-w-xl mx-auto">
          Short-term and long-term furnished rooms in Mesa &amp; Tempe, Arizona. Book directly — no
          fees.
        </p>
        <Link
          href="/rooms"
          className="inline-block bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-8 py-3 shadow-[0_0_10px_rgba(175,201,234,0.30)] hover:opacity-90 transition-opacity"
        >
          Browse Rooms
        </Link>
      </div>

      <div className="relative z-10 mt-16 w-full max-w-2xl">
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl px-8 py-6 shadow-[0_8px_40px_rgba(175,201,234,0.06)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-xs uppercase tracking-widest text-secondary font-medium mb-1">
              Availability
            </p>
            <p className="font-display font-bold text-on-surface text-lg">Ready to move in</p>
          </div>
          <div className="hidden sm:block h-10 w-px bg-outline-variant" />
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-secondary font-medium mb-1">
              Options
            </p>
            <p className="font-display font-bold text-on-surface text-lg">Short &amp; Long Term</p>
          </div>
          <div className="hidden sm:block h-10 w-px bg-outline-variant" />
          <div className="text-center sm:text-right">
            <p className="text-xs uppercase tracking-widest text-secondary font-medium mb-1">
              Location
            </p>
            <p className="font-display font-bold text-on-surface text-lg">Mesa / Tempe, AZ</p>
          </div>
        </div>
      </div>
    </section>
  )
}
