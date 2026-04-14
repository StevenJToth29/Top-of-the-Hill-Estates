import HeroSearch from './HeroSearch'

export default function Hero() {
  return (
    <section className="relative flex min-h-[88vh] flex-col items-center justify-center overflow-hidden px-4">
      {/* Background — replace the gradient with a real photo:
          className="absolute inset-0 object-cover" as next/image fill */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, #0D1B2A 0%, #1C3552 40%, #2A4A6B 65%, #1B3A2E 100%)',
        }}
      />
      {/* Warm desert ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 60% 40%, rgba(45,212,191,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 30% 70%, rgba(255,200,100,0.06) 0%, transparent 60%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-5xl text-center">
        <p className="mb-4 text-xs uppercase tracking-widest text-primary/90 font-medium">
          Mesa &amp; Tempe, Arizona
        </p>
        <h1
          className="font-display font-extrabold text-white leading-tight mb-6"
          style={{ fontSize: 'clamp(2.25rem, 6vw, 4rem)' }}
        >
          Find Your Home in the{' '}
          <span className="text-primary italic">Heart of Arizona</span>
        </h1>
        <p className="text-white/70 text-lg mb-12 max-w-xl mx-auto">
          Furnished rooms for short-term and long-term stays. Book directly — no platform fees.
        </p>

        {/* Floating search bar */}
        <div className="mx-auto max-w-4xl">
          <HeroSearch />
        </div>
      </div>
    </section>
  )
}
