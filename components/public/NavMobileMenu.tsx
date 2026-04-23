'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

const navLinks = [
  { label: 'Rooms', href: '/rooms' },
  { label: 'About Us', href: '/#about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Manage Booking', href: '/booking/manage' },
]

export default function NavMobileMenu() {
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* Hamburger button */}
      <button
        className="md:hidden p-2 text-on-surface-variant hover:text-on-surface transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
      </button>

      {/* Mobile drawer */}
      <div
        className={clsx(
          'md:hidden overflow-hidden transition-all duration-300 border-t border-surface absolute top-full left-0 right-0 bg-background',
          open ? 'max-h-64' : 'max-h-0',
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-3">
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
    </>
  )
}
