'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ApplicationsTab from '@/components/admin/ApplicationsTab'

interface Props {
  bookingsContent: ReactNode
}

function usePendingApplicationCount() {
  const [count, setCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchRef = useRef<() => Promise<void>>(async () => {})

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
    fetchRef.current = fetchCount
    fetchCount()
    intervalRef.current = setInterval(fetchCount, 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  return { count, refresh: () => fetchRef.current() }
}

export default function BookingsPageTabs({ bookingsContent }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'applications' ? 'applications' : 'bookings'
  const [tab, setTab] = useState<'bookings' | 'applications'>(initialTab)
  const { count: pendingCount, refresh: refreshCount } = usePendingApplicationCount()

  function switchTab(t: 'bookings' | 'applications') {
    setTab(t)
    const params = new URLSearchParams(searchParams.toString())
    if (t === 'bookings') params.delete('tab')
    else params.set('tab', t)
    router.replace(`/admin/bookings?${params.toString()}`, { scroll: false })
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-outline mb-6" role="tablist">
        {(['bookings', 'applications'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            id={`tab-${t}`}
            onClick={() => switchTab(t)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors
              ${tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            {t}
            {t === 'applications' && !!pendingCount && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>
      <div id={tab === 'bookings' ? 'tabpanel-bookings' : 'tabpanel-applications'} role="tabpanel">
        {tab === 'bookings' ? bookingsContent : <ApplicationsTab onDecision={refreshCount} />}
      </div>
    </div>
  )
}
