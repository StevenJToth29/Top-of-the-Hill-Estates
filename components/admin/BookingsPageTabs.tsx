'use client'

import { useState } from 'react'
import ApplicationsTab from '@/components/admin/ApplicationsTab'

interface Props {
  bookingsContent: React.ReactNode
}

export default function BookingsPageTabs({ bookingsContent }: Props) {
  const [tab, setTab] = useState<'bookings' | 'applications'>('bookings')

  return (
    <div>
      <div className="flex gap-1 border-b border-outline mb-6">
        {(['bookings', 'applications'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors
              ${tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'bookings' ? bookingsContent : <ApplicationsTab />}
    </div>
  )
}
