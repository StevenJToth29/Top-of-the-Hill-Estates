'use client'

import { NAV_ITEMS } from '@/components/admin/AdminSidebar'
import { usePathname } from 'next/navigation'

interface AdminNavProps {
  email?: string
}

export default function AdminNav({ email }: AdminNavProps) {
  const pathname = usePathname()

  const title =
    NAV_ITEMS.find(
      ({ href }) => href === pathname || (href !== '/admin' && pathname.startsWith(href)),
    )?.label ?? 'Admin'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-outline-variant bg-surface-lowest/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-2 font-body text-sm">
        <span className="text-on-surface-variant">Admin</span>
        <span className="text-outline-variant">/</span>
        <span className="font-medium text-on-surface">{title}</span>
      </div>
      {email && (
        <span className="font-body text-xs text-on-surface-variant">{email}</span>
      )}
    </header>
  )
}
