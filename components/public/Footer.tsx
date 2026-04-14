import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="bg-surface-lowest">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Image
                src="/logo.png"
                alt="Top of the Hill Rooms"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <p className="font-display font-bold text-primary text-base leading-tight">
                Top of the Hill Estates, LLC
              </p>
            </div>
            <address className="not-italic text-on-surface-variant text-sm space-y-1">
              <p>Mesa / Tempe, Arizona</p>
              <p>
                <a href="tel:+14805550000" className="hover:text-secondary transition-colors">
                  (480) 555-0000
                </a>
              </p>
              <p>
                <a
                  href="mailto:hello@topofthehillestates.com"
                  className="hover:text-secondary transition-colors"
                >
                  hello@topofthehillestates.com
                </a>
              </p>
            </address>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-secondary font-medium mb-3">
              Legal
            </p>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              <li>
                <Link href="/privacypolicy" className="hover:text-secondary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/termsandconditions" className="hover:text-secondary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-secondary transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-secondary font-medium mb-3">
              Direct Booking
            </p>
            <p className="text-on-surface-variant text-sm">
              Book directly and skip the platform fees. Furnished rooms for short-term and long-term
              stays in the heart of the Valley.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-outline-variant text-center text-on-surface-variant text-xs">
          &copy; 2024 Top of the Hill Estates, LLC. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
