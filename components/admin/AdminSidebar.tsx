'use client'

import { createClient } from '@/lib/supabase-browser'
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  HomeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: ChartBarIcon },
  { label: 'Rooms', href: '/admin/rooms', icon: HomeIcon },
  { label: 'Bookings', href: '/admin/bookings', icon: CalendarIcon },
  { label: 'Calendar', href: '/admin/calendar', icon: CalendarDaysIcon },
  { label: 'iCal Sync', href: '/admin/ical', icon: ArrowPathIcon },
  { label: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon },
]

const supabase = createClient()

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  function isActive(href: string) {
    return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="px-6 py-5 flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="Top of the Hill Rooms"
          width={36}
          height={36}
          className="rounded-lg shrink-0"
        />
        <span className="font-display text-base font-bold text-primary tracking-tight leading-tight">
          TOTH Admin
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={[
              'flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm font-medium transition',
              isActive(href)
                ? 'bg-surface-highest text-on-surface'
                : 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface',
            ].join(' ')}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 pb-6">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm font-medium text-on-surface-variant transition hover:bg-surface-high hover:text-on-surface"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden w-64 shrink-0 bg-surface-container md:flex md:flex-col min-h-screen">
        {sidebarContent}
      </aside>

      <div className="md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="fixed left-4 top-4 z-40 rounded-xl bg-surface-container/80 p-2 backdrop-blur-xl text-on-surface-variant hover:text-on-surface"
          aria-label="Open navigation"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>

        {open && (
          <div
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}

        <aside
          className={[
            'fixed inset-y-0 left-0 z-50 w-64 bg-surface-container transition-transform duration-300',
            open ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface"
            aria-label="Close navigation"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          {sidebarContent}
        </aside>
      </div>
    </>
  )
}
