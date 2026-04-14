import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="bg-background border-t border-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Image
                src="/logo.png"
                alt="Top of the Hill Rooms"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="font-display font-bold text-on-surface text-base">
                Top of the Hill <span className="text-primary">Rooms</span>
              </span>
            </div>
            <address className="not-italic text-on-surface-variant font-body text-sm space-y-1">
              <p>Mesa / Tempe, Arizona</p>
              <p>
                <a href="tel:+14805550000" className="hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                  (480) 555-0000
                </a>
              </p>
              <p>
                <a
                  href="mailto:hello@topofthehillestates.com"
                  className="hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  hello@topofthehillestates.com
                </a>
              </p>
            </address>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold mb-3">
              Legal
            </p>
            <ul className="space-y-2 text-sm text-on-surface-variant font-body">
              <li>
                <Link href="/privacypolicy" className="hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/termsandconditions" className="hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold mb-3">
              Direct Booking
            </p>
            <p className="text-on-surface-variant font-body text-sm">
              Book directly and skip the platform fees. Furnished rooms for short-term and long-term
              stays in the heart of the Valley.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-surface flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant font-body">
          <span>&copy; 2025 Top of the Hill Estates, LLC. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/privacypolicy" className="hover:text-on-surface transition-colors duration-150">Privacy</Link>
            <Link href="/termsandconditions" className="hover:text-on-surface transition-colors duration-150">Terms</Link>
            <Link href="/contact" className="hover:text-on-surface transition-colors duration-150">Help</Link>
            <Link href="/admin" className="hover:text-on-surface transition-colors duration-150">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
