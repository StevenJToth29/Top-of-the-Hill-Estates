'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ApplicationsTab from '@/components/admin/ApplicationsTab'

type Tab = 'bookings' | 'applications' | 'reviews'

interface Props {
  bookingsContent: ReactNode
  reviewsContent: ReactNode
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

export default function BookingsPageTabs({ bookingsContent, reviewsContent }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawTab = searchParams.get('tab')
  const initialTab: Tab = rawTab === 'applications' ? 'applications' : rawTab === 'reviews' ? 'reviews' : 'bookings'
  const [tab, setTab] = useState<Tab>(initialTab)
  const { count: pendingCount, refresh: refreshCount } = usePendingApplicationCount()

  function switchTab(t: Tab) {
    setTab(t)
    const params = new URLSearchParams(searchParams.toString())
    if (t === 'bookings') params.delete('tab')
    else params.set('tab', t)
    router.replace(`/admin/bookings?${params.toString()}`, { scroll: false })
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-outline mb-6" role="tablist">
        {(['bookings', 'applications', 'reviews'] as const).map((t) => (
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
      <div id={`tabpanel-${tab}`} role="tabpanel">
        {tab === 'bookings' && bookingsContent}
        {tab === 'applications' && <ApplicationsTab onDecision={refreshCount} />}
        {tab === 'reviews' && reviewsContent}
      </div>
    </div>
  )
}
