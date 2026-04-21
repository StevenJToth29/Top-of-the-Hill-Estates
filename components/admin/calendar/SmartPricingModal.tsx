'use client'

import { useState } from 'react'
import { ModalShell } from './ModalShell'
import type { Room } from '@/types'

interface SmartPricingModalProps {
  room: Room
  onClose: () => void
  onSuccess: (roomId: string, priceMin: number, priceMax: number) => void
}

export function SmartPricingModal({ room, onClose, onSuccess }: SmartPricingModalProps) {
  const [priceMin, setPriceMin] = useState(String(room.price_min ?? Math.round(room.nightly_rate * 0.7)))
  const [priceMax, setPriceMax] = useState(String(room.price_max ?? Math.round(room.nightly_rate * 1.5)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const min = parseFloat(priceMin)
    const max = parseFloat(priceMax)
    if (!min || !max || min >= max) {
      setError('Price floor must be less than ceiling.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_min: min, price_max: max }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to save pricing range')
      }
      onSuccess(room.id, min, max)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const minNum = parseFloat(priceMin)
  const maxNum = parseFloat(priceMax)
  const showBar = minNum > 0 && maxNum > minNum

  return (
    <ModalShell title={`Smart Pricing — ${room.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-xs text-slate-500">
          Set the price floor and ceiling. The future auto-pricing engine will stay within this range.
          Manual per-night overrides always take priority.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Price Floor (min)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
                min={1} step={1} required
                className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Price Ceiling (max)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
                min={1} step={1} required
                className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Current base rate: <strong>${room.nightly_rate}/night</strong>
        </p>

        {showBar && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>${priceMin}</span>
              <span>${priceMax}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 relative">
              <div className="h-2 rounded-full" style={{ background: '#2DD4BF', width: '100%' }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-700 border-2 border-white shadow"
                style={{
                  left: `${Math.min(99, Math.max(1, ((room.nightly_rate - minNum) / (maxNum - minNum)) * 100))}%`,
                }}
                title={`Base rate: $${room.nightly_rate}`}
              />
            </div>
            <p className="text-xs text-center text-slate-400">▲ base rate</p>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: '#2DD4BF' }}>
            {saving ? 'Saving…' : 'Save Range'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
