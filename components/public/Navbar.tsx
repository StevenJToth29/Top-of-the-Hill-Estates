'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

const navLinks = [
  { label: 'Rooms', href: '/rooms' },
  { label: 'About Us', href: '/#about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Manage Booking', href: '/booking/manage' },
]

interface NavbarProps {
  logoUrl?: string
  logoSize?: number
}

export default function Navbar({ logoUrl, logoSize = 52 }: NavbarProps) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-surface shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ minHeight: Math.max(64, logoSize + 24) }}>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
            <Image
              src={logoUrl ?? '/logo.png'}
              alt="Top of the Hill Rooms"
              width={logoSize}
              height={logoSize}
              style={{ width: logoSize, height: logoSize }}
              className="rounded-xl"
              unoptimized={!!logoUrl}
            />
            <span className="font-display font-bold text-on-surface text-lg tracking-tight">
              Top of the Hill <span className="text-primary">Rooms</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-on-surface-variant hover:text-on-surface transition-colors duration-150 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/rooms"
              className="bg-primary text-white font-semibold rounded-lg px-5 py-2 text-sm hover:bg-secondary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Book a Room
            </Link>
          </nav>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-on-surface-variant hover:text-on-surface transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={clsx(
          'md:hidden overflow-hidden transition-all duration-300 border-t border-surface',
          open ? 'max-h-64' : 'max-h-0',
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-3 bg-background">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="py-2 text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors duration-150"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/rooms"
            onClick={() => setOpen(false)}
            className="mt-2 inline-block bg-primary text-white font-semibold rounded-lg px-5 py-2 text-sm text-center hover:bg-secondary transition-colors duration-150"
          >
            Book a Room
          </Link>
        </nav>
      </div>
    </header>
  )
}
