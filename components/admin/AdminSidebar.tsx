'use client'

import { createClient } from '@/lib/supabase-browser'
import {
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  Bars3Icon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  StarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useEffect, useRef } from 'react'

function BedIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5V19h18v-5.5M3 13.5A2.5 2.5 0 015.5 11h13A2.5 2.5 0 0121 13.5M3 13.5V8a1 1 0 011-1h1.5M21 13.5V8a1 1 0 00-1-1h-1.5M5.5 7V5.5A1.5 1.5 0 017 4h3.5a1.5 1.5 0 011.5 1.5V7m0 0h-6m6 0h2m0 0V5.5A1.5 1.5 0 0113.5 4H17a1.5 1.5 0 011.5 1.5V7" />
    </svg>
  )
}
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

function usePendingApplicationCount() {
  const [count, setCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch('/api/admin/applications')
        if (!res.ok) return
        const data = await res.json()
        setCount((data.applications ?? []).length)
      } catch {
        // silently ignore network errors
      }
    }
    fetchCount()
    intervalRef.current = setInterval(fetchCount, 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  return count
}

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: ChartBarIcon },
  { label: 'Properties', href: '/admin/properties', icon: BuildingOfficeIcon },
  { label: 'Units', href: '/admin/rooms', icon: BedIcon },
  { label: 'Bookings', href: '/admin/bookings', icon: CalendarIcon },
  { label: 'Calendar', href: '/admin/calendar', icon: CalendarDaysIcon },
  { label: 'Payout', href: '/admin/payout-accounts', icon: BanknotesIcon },
  { label: 'Email', href: '/admin/email/settings', icon: EnvelopeIcon },
  { label: 'Reviews', href: '/admin/reviews', icon: StarIcon },
  { label: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon },
]

const supabase = createClient()

interface AdminSidebarProps {
  logoUrl?: string
  logoSize?: number
}

export default function AdminSidebar({ logoUrl, logoSize = 52 }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const pendingApplicationCount = usePendingApplicationCount()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  function isActive(href: string) {
    return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  }

  function navButton(
    { label, href, icon: Icon }: (typeof NAV_ITEMS)[number],
    opts: { iconOnly: boolean; onNavigate?: () => void; badge?: number },
  ) {
    return (
      <button
        key={href}
        title={opts.iconOnly ? label : undefined}
        onClick={() => {
          opts.onNavigate?.()
          router.push(href)
          router.refresh()
        }}
        className={[
          'flex w-full items-center rounded-xl px-3 py-2.5 font-body text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          opts.iconOnly ? 'justify-center' : 'gap-3',
          isActive(href)
            ? 'bg-surface-highest text-on-surface'
            : 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface',
        ].join(' ')}
      >
        <span className="relative shrink-0">
          <Icon className="h-5 w-5" />
          {!!opts.badge && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-bold leading-none text-white">
              {opts.badge > 99 ? '99+' : opts.badge}
            </span>
          )}
        </span>
        {!opts.iconOnly && label}
      </button>
    )
  }

  const mobileSidebarContent = (
    <div className="flex h-full flex-col">
      <div className="px-6 py-5 flex items-center gap-3">
        <Image
          src={logoUrl ?? '/logo.png'}
          alt="Top of the Hill Estates"
          width={logoSize}
          height={logoSize}
          style={{ width: logoSize, height: logoSize }}
          className="rounded-lg shrink-0"
          unoptimized={!!logoUrl}
        />
        <span className="font-display text-base font-bold text-primary tracking-tight leading-tight">
          TOTH Admin
        </span>
      </div>

      <div className="mx-4 mb-3 h-px bg-surface-high" />

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) =>
          navButton(item, {
            iconOnly: false,
            onNavigate: () => setOpen(false),
            badge: item.href === '/admin/bookings' ? pendingApplicationCount : undefined,
          }),
        )}
      </nav>

      <div className="px-3 pb-6">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm font-medium text-on-surface-variant transition-colors duration-150 hover:bg-surface-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={[
          'hidden md:flex md:flex-col min-h-screen shrink-0 bg-surface-container transition-all duration-200',
          collapsed ? 'w-16' : 'w-52',
        ].join(' ')}
      >
        <div className="flex h-full flex-col">
          {/* Header: logo (centered) + collapse toggle */}
          <div className="py-5 px-3 flex flex-col items-center gap-3">
            <Image
              src={logoUrl ?? '/logo.png'}
              alt="Top of the Hill Estates"
              width={collapsed ? 32 : logoSize}
              height={collapsed ? 32 : logoSize}
              style={{ width: collapsed ? 32 : logoSize, height: collapsed ? 32 : logoSize }}
              className="rounded-lg shrink-0"
              unoptimized={!!logoUrl}
            />
            <button
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="rounded-xl p-1.5 text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          </div>

          <div className="mx-4 mb-3 h-px bg-surface-high" />

          <nav className="flex-1 space-y-1 px-2">
            {NAV_ITEMS.map((item) =>
              navButton(item, {
                iconOnly: collapsed,
                badge: item.href === '/admin/bookings' ? pendingApplicationCount : undefined,
              }),
            )}
          </nav>

          {/* Sign out */}
          <div className="px-2 pb-6">
            <button
              onClick={handleSignOut}
              title={collapsed ? 'Sign Out' : undefined}
              className={[
                'flex w-full items-center rounded-xl px-3 py-2.5 font-body text-sm font-medium text-on-surface-variant transition-colors duration-150 hover:bg-surface-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                collapsed ? 'justify-center' : 'gap-3',
              ].join(' ')}
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
              {!collapsed && 'Sign Out'}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile hamburger + drawer */}
      <div className="md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="fixed left-4 top-4 z-40 rounded-xl bg-surface-container/80 p-2 backdrop-blur-xl text-on-surface-variant hover:text-on-surface transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            'fixed inset-y-0 left-0 z-50 w-52 bg-surface-container transition-transform duration-300',
            open ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            aria-label="Close navigation"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          {mobileSidebarContent}
        </aside>
      </div>
    </>
  )
}
