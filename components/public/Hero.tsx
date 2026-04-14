import HeroSearch from './HeroSearch'

export default function Hero() {
  return (
    <section className="relative flex min-h-[88vh] flex-col items-center justify-center overflow-hidden px-4">
      {/* Background — replace the gradient with a real photo:
          className="absolute inset-0 object-cover" as next/image fill */}
      {/* Deep navy-to-teal gradient matches the [data-admin] dark palette anchored to brand colors */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(13_27_42)_0%,rgb(28_53_82)_40%,rgb(42_74_107)_65%,rgb(27_58_46)_100%)]" />
      {/* Ambient teal + desert-warm glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_60%_40%,rgb(45_212_191_/_0.08)_0%,transparent_70%),radial-gradient(ellipse_50%_40%_at_30%_70%,rgb(255_200_100_/_0.06)_0%,transparent_60%)]" />

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <p className="mb-4 text-xs uppercase tracking-widest text-primary/90 font-medium">
          Mesa &amp; Tempe, Arizona
        </p>
        <h1 className="font-display font-extrabold text-white leading-tight mb-6 text-[clamp(2.25rem,6vw,4rem)]">
          Find Your Home in the{' '}
          <span className="text-primary italic">Heart of Arizona</span>
        </h1>
        <p className="text-white/70 font-body text-lg mb-12 max-w-xl mx-auto">
          Furnished rooms for short-term and long-term stays. Book directly — no platform fees.
        </p>

        {/* Search bar — matches site max-width */}
        <HeroSearch />
      </div>
    </section>
  )
}
