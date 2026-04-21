'use client'

import { useState } from 'react'
import { format, eachDayOfInterval } from 'date-fns'
import { ModalShell } from './ModalShell'
import type { Room } from '@/types'

const REASONS = ['Maintenance', 'Personal', 'Renovation', 'Other'] as const

interface BlockDatesModalProps {
  rooms: Room[]
  initialRoomId: string
  initialFrom: string
  initialTo: string
  onClose: () => void
  onSuccess: (roomId: string, dates: string[]) => void
}

export function BlockDatesModal({
  rooms,
  initialRoomId,
  initialFrom,
  initialTo,
  onClose,
  onSuccess,
}: BlockDatesModalProps) {
  const [roomId, setRoomId] = useState(initialRoomId)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [reason, setReason] = useState<string>('Maintenance')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dates = from && to
    ? eachDayOfInterval({ start: new Date(from + 'T00:00:00'), end: new Date(to + 'T00:00:00') })
        .map((d) => format(d, 'yyyy-MM-dd'))
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!roomId || dates.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/date-overrides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, dates, is_blocked: true, block_reason: reason, note }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to block dates')
      }
      onSuccess(roomId, dates)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Block Dates" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Room</label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  reason === r
                    ? 'bg-teal-500 text-white border-teal-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Note (optional)</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Additional details..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>

        {dates.length > 0 && (
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            Blocking <strong>{dates.length}</strong> {dates.length === 1 ? 'night' : 'nights'} on{' '}
            <strong>{rooms.find((r) => r.id === roomId)?.name}</strong>
          </p>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving || dates.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: '#2DD4BF' }}>
            {saving ? 'Blocking…' : `Block ${dates.length} ${dates.length === 1 ? 'Night' : 'Nights'}`}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
