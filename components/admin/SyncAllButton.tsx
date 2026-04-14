'use client'

import { useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'

export default function SyncAllButton() {
  const [syncing, setSyncing] = useState(false)
  const router = useRouter()

  async function handleSyncAll() {
    setSyncing(true)
    try {
      await fetch('/api/admin/ical-sync', { method: 'POST' })
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSyncAll}
      disabled={syncing}
      className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-6 py-2.5 font-semibold shadow-[0_0_10px_rgba(175,201,234,0.30)] disabled:opacity-50 transition-opacity"
    >
      <ArrowPathIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Syncing…' : 'Sync All'}
    </button>
  )
}
