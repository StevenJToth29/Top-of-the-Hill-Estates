'use client'

import { useState } from 'react'
import { TrashIcon, ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline'
import type { ICalSource } from '@/types'

interface ICalSourcesManagerProps {
  roomId: string
  sources: ICalSource[]
}

const PLATFORMS = [
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'vrbo', label: 'VRBO' },
  { value: 'other', label: 'Other' },
]

export default function ICalSourcesManager({ roomId, sources: initialSources }: ICalSourcesManagerProps) {
  const [sources, setSources] = useState<ICalSource[]>(initialSources)
  const [platform, setPlatform] = useState<'airbnb' | 'vrbo' | 'other'>('airbnb')
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function addSource() {
    if (!url.trim()) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ical-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, platform, ical_url: url.trim() }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: ICalSource = await res.json()
      setSources((prev) => [...prev, data])
      setUrl('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setAdding(false)
    }
  }

  async function deleteSource(id: string) {
    setError(null)
    try {
      const res = await fetch(`/api/admin/ical-sources?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setSources((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete source')
    }
  }

  async function syncSource(id: string) {
    setSyncing(id)
    setError(null)
    try {
      const res = await fetch('/api/admin/ical-sources/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: id }),
      })
      if (!res.ok) throw new Error(await res.text())
      // Update last_synced_at optimistically
      setSources((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, last_synced_at: new Date().toISOString() } : s,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  function formatSyncTime(t: string | null) {
    if (!t) return 'Never'
    return new Date(t).toLocaleString()
  }

  return (
    <div className="space-y-4">
      {/* Source list */}
      {sources.length > 0 ? (
        <div className="space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-3 bg-surface-highest/20 rounded-xl px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-on-surface capitalize">{source.platform}</span>
                  {!source.is_active && (
                    <span className="text-xs bg-error-container/30 text-error rounded-full px-2 py-0.5">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant/60 truncate mt-0.5" title={source.ical_url}>
                  {source.ical_url}
                </p>
                <p className="text-xs text-on-surface-variant/40 mt-0.5">
                  Last sync: {formatSyncTime(source.last_synced_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => syncSource(source.id)}
                  disabled={syncing === source.id}
                  className="flex items-center gap-1.5 text-xs bg-surface-container rounded-lg px-3 py-1.5 text-on-surface-variant hover:bg-surface-high transition-colors disabled:opacity-50"
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 ${syncing === source.id ? 'animate-spin' : ''}`} />
                  Sync
                </button>
                <button
                  type="button"
                  onClick={() => deleteSource(source.id)}
                  className="p-1.5 rounded-lg text-on-surface-variant/60 hover:text-error hover:bg-error-container/20 transition-colors"
                  aria-label="Delete source"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant/50 text-center py-4">
          No iCal sources configured.
        </p>
      )}

      {error && (
        <p className="text-sm text-error bg-error-container/30 rounded-xl px-4 py-2">{error}</p>
      )}

      {/* Add source form */}
      <div className="bg-surface-highest/20 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-on-surface-variant">Add iCal Source</p>
        <div className="flex gap-2">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as 'airbnb' | 'vrbo' | 'other')}
            className="bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://airbnb.com/calendar/ical/..."
            className="flex-1 bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
          />
          <button
            type="button"
            onClick={addSource}
            disabled={adding || !url.trim()}
            className="flex items-center gap-1.5 bg-surface-container rounded-xl px-4 py-3 text-on-surface-variant text-sm hover:bg-surface-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusIcon className="w-4 h-4" />
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
