'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

const navLinks = [
  { label: 'Browse Rooms', href: '/rooms' },
  { label: 'Contact', href: '/contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-surface-lowest/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="font-display font-bold text-primary text-lg tracking-tight">
            Top of the Hill Rooms
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-on-surface-variant hover:text-on-surface transition-colors text-sm font-medium"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/rooms"
              className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-6 py-2 text-sm shadow-[0_0_10px_rgba(175,201,234,0.30)] hover:opacity-90 transition-opacity"
            >
              Book a Room
            </Link>
          </nav>

          <button
            className="md:hidden p-2 text-on-surface-variant hover:text-on-surface"
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

      <div
        className={clsx(
          'md:hidden overflow-hidden transition-all duration-300',
          open ? 'max-h-64' : 'max-h-0',
        )}
      >
        <nav className="flex flex-col gap-1 px-4 pb-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="py-2 text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/rooms"
            onClick={() => setOpen(false)}
            className="mt-2 inline-block bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-6 py-2 text-sm text-center shadow-[0_0_10px_rgba(175,201,234,0.30)] hover:opacity-90 transition-opacity"
          >
            Book a Room
          </Link>
        </nav>
      </div>
    </header>
  )
}
