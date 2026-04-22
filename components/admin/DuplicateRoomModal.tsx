'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { slugify } from '@/lib/slugify'

interface Props {
  isOpen: boolean
  onClose: () => void
  roomId: string
  roomName: string
}

export default function DuplicateRoomModal({ isOpen, onClose, roomId, roomName }: Props) {
  const router = useRouter()
  const [name, setName] = useState(`${roomName} (Copy)`)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName(`${roomName} (Copy)`)
      setError(null)
    }
  }, [isOpen, roomName])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, loading, onClose])

  const slug = slugify(name)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      router.push(`/admin/rooms/${data.id}/edit`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose()} />
      <div className="relative bg-background rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-on-surface">Duplicate Room</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-on-surface-variant mb-5">
          Duplicating: <span className="font-medium text-on-surface">{roomName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="duplicate-room-name" className="block text-sm font-medium text-on-surface mb-1.5">
              New Room Name
            </label>
            <input
              id="duplicate-room-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
              autoFocus
            />
            <p className="mt-1.5 text-xs text-on-surface-variant/60">
              Slug: <span className="font-mono">{slug || '—'}</span>
            </p>
          </div>

          {error && (
            <p className="text-sm text-error bg-error-container/20 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm rounded-xl bg-secondary text-on-secondary font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              Duplicate
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
