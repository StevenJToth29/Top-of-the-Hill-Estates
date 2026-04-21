'use client'

import { useState } from 'react'
import { format, eachDayOfInterval, getDay } from 'date-fns'
import { ModalShell } from './ModalShell'
import type { Room } from '@/types'

type ApplyTo = 'all' | 'weekends' | 'weekdays'

interface SetPriceModalProps {
  rooms: Room[]
  initialRoomId: string
  initialFrom: string
  initialTo: string
  onClose: () => void
  onSuccess: (roomId: string, dates: string[], price: number) => void
}

export function SetPriceModal({
  rooms,
  initialRoomId,
  initialFrom,
  initialTo,
  onClose,
  onSuccess,
}: SetPriceModalProps) {
  const [roomId, setRoomId] = useState(initialRoomId)
  const [from] = useState(initialFrom)
  const [to] = useState(initialTo)
  const [price, setPrice] = useState<string>('')
  const [applyTo, setApplyTo] = useState<ApplyTo>('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const room = rooms.find((r) => r.id === roomId)
  const baseRate = room?.nightly_rate ?? 0
  const priceNum = parseFloat(price) || 0
  const pctDiff = baseRate > 0 ? ((priceNum - baseRate) / baseRate) * 100 : 0

  const allDates = from && to
    ? eachDayOfInterval({ start: new Date(from + 'T00:00:00'), end: new Date(to + 'T00:00:00') })
    : []

  const filtered = allDates.filter((d) => {
    const dow = getDay(d)
    if (applyTo === 'weekends') return dow === 5 || dow === 6
    if (applyTo === 'weekdays') return dow >= 1 && dow <= 4
    return true
  })

  const dates = filtered.map((d) => format(d, 'yyyy-MM-dd'))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!roomId || !priceNum || dates.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/date-overrides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, dates, price_override: priceNum }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to set price')
      }
      onSuccess(roomId, dates, priceNum)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Set Price" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Room</label>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Price per night</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                min={0} step={1} placeholder={String(baseRate)}
                className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            {priceNum > 0 && (
              <span className={`text-xs font-semibold ${pctDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {pctDiff >= 0 ? '+' : ''}{pctDiff.toFixed(0)}%
              </span>
            )}
          </div>
          {room && (
            <p className="text-xs text-slate-400 mt-1">
              Base rate: ${baseRate}/night
              {room.price_min != null && room.price_max != null &&
                ` · Smart range: $${room.price_min}–$${room.price_max}`}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Apply to</label>
          <div className="flex gap-4">
            {(['all', 'weekends', 'weekdays'] as ApplyTo[]).map((v) => (
              <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" value={v} checked={applyTo === v}
                  onChange={() => setApplyTo(v)} className="accent-teal-500" />
                <span className="text-xs text-slate-700">
                  {v === 'all' ? 'All selected days' : v === 'weekends' ? 'Fri–Sat only' : 'Weekdays only'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {dates.length > 0 && priceNum > 0 && (
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            Setting <strong>${priceNum}</strong>/night on <strong>{dates.length}</strong>{' '}
            {dates.length === 1 ? 'night' : 'nights'}
          </p>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving || !priceNum || dates.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: '#2DD4BF' }}>
            {saving ? 'Saving…' : 'Save Price'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
