'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardDocumentIcon,
  ArrowPathIcon,
  TrashIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import type { Room, Property, ICalSource } from '@/types'

interface ICalSyncPanelProps {
  room: Room & { property: Property; ical_sources: ICalSource[] }
  siteUrl: string
}

const PLATFORMS = [
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'vrbo', label: 'VRBO' },
  { value: 'other', label: 'Other' },
] as const

const PLATFORM_BADGES: Record<string, string> = {
  airbnb: 'bg-[#FF5A5F]/20 text-[#FF5A5F]', // Airbnb brand red — intentional
  vrbo: 'bg-primary/20 text-primary',
  other: 'bg-surface-highest/60 text-on-surface-variant',
}

function formatLastSynced(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ICalSyncPanel({ room, siteUrl }: ICalSyncPanelProps) {
  const router = useRouter()
  const exportUrl = `${siteUrl}/api/ical/${room.ical_export_token ?? ''}`

  const [sources, setSources] = useState<ICalSource[]>(room.ical_sources ?? [])
  const [platform, setPlatform] = useState<string>('airbnb')
  const [icalUrl, setIcalUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [addError, setAddError] = useState('')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable — silent fail
    }
  }

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault()
    if (!icalUrl.trim()) return
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch('/api/admin/ical-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: room.id, platform, ical_url: icalUrl.trim() }),
      })
      if (!res.ok) {
        const json = await res.json()
        setAddError(json.error ?? 'Failed to add source')
        return
      }
      const newSource: ICalSource = await res.json()
      setSources((prev) => [...prev, newSource])
      setIcalUrl('')
    } catch {
      setAddError('Network error')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(sourceId: string) {
    setDeletingId(sourceId)
    try {
      await fetch(`/api/admin/ical-sources/${sourceId}`, { method: 'DELETE' })
      setSources((prev) => prev.filter((s) => s.id !== sourceId))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSyncRoom() {
    setSyncing(true)
    try {
      await fetch('/api/admin/ical-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: room.id }),
      })
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Export URL */}
      <div>
        <span className="text-xs uppercase tracking-widest text-secondary block mb-2">
          Export URL
        </span>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-xs bg-surface-container rounded-xl px-4 py-2 text-on-surface truncate">
            {exportUrl}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-highest/40 text-on-surface-variant hover:text-secondary transition-colors text-sm shrink-0"
          >
            <ClipboardDocumentIcon className="w-4 h-4" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Import Sources */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-widest text-secondary">
            Import Sources
          </span>
          <button
            type="button"
            onClick={handleSyncRoom}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-secondary transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Room'}
          </button>
        </div>

        {sources.length === 0 ? (
          <p className="text-sm text-on-surface-variant italic">No import sources configured.</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((src) => (
              <li
                key={src.id}
                className="flex items-center gap-3 bg-surface-container rounded-xl px-4 py-2.5"
              >
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-lg shrink-0 ${PLATFORM_BADGES[src.platform] ?? PLATFORM_BADGES.other}`}
                >
                  {src.platform}
                </span>
                <span className="flex-1 font-mono text-xs text-on-surface-variant truncate">
                  {src.ical_url}
                </span>
                <span className="text-xs text-on-surface-variant shrink-0 hidden sm:block">
                  {formatLastSynced(src.last_synced_at)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(src.id)}
                  disabled={deletingId === src.id}
                  className="shrink-0 p-1 rounded-lg text-on-surface-variant hover:text-error transition-colors disabled:opacity-50"
                  aria-label="Delete source"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add Source Form */}
        <form onSubmit={handleAddSource} className="mt-3 flex flex-col sm:flex-row gap-2">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="bg-surface-highest/40 rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 text-sm sm:w-36 shrink-0"
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value} className="bg-surface">
                {p.label}
              </option>
            ))}
          </select>
          <input
            type="url"
            value={icalUrl}
            onChange={(e) => setIcalUrl(e.target.value)}
            placeholder="https://calendar.example.com/export.ics"
            required
            className="flex-1 bg-surface-highest/40 rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 text-sm placeholder:text-on-surface-variant/50"
          />
          <button
            type="submit"
            disabled={adding}
            className="flex items-center gap-1.5 bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-5 py-2.5 font-semibold shadow-[0_0_10px_rgba(45,212,191,0.30)] disabled:opacity-50 text-sm shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
        {addError && <p className="mt-1.5 text-sm text-error">{addError}</p>}
      </div>
    </div>
  )
}
