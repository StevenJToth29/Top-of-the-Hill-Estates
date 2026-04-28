'use client'

import { useState } from 'react'
import { ModalShell } from './ModalShell'
import type { Room } from '@/types'

interface SmartPricingModalProps {
  room: Room
  onClose: () => void
  onSuccess: (roomId: string, updates: Partial<Room>, enabled: boolean) => void
}

type Aggressiveness = 'conservative' | 'moderate' | 'aggressive'

const AGGRESSIVENESS_OPTIONS: { value: Aggressiveness; label: string; hint: string }[] = [
  { value: 'conservative', label: 'Conservative', hint: '50% signal weight — gentle adjustments' },
  { value: 'moderate', label: 'Moderate', hint: 'Full signal weight — balanced adjustments' },
  { value: 'aggressive', label: 'Aggressive', hint: '1.5× signal weight — larger swings' },
]

export function SmartPricingModal({ room, onClose, onSuccess }: SmartPricingModalProps) {
  const [enabled, setEnabled] = useState(room.smart_pricing_enabled ?? false)
  const [aggressiveness, setAggressiveness] = useState<Aggressiveness>(
    room.smart_pricing_aggressiveness ?? 'moderate',
  )
  const [priceMin, setPriceMin] = useState(String(room.price_min ?? Math.round(room.nightly_rate * 0.7)))
  const [priceMax, setPriceMax] = useState(String(room.price_max ?? Math.round(room.nightly_rate * 1.5)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const min = parseFloat(priceMin)
    const max = parseFloat(priceMax)
    if (enabled && (!min || !max || min >= max)) {
      setError('Price floor must be less than ceiling when smart pricing is enabled.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        smart_pricing_enabled: enabled,
        smart_pricing_aggressiveness: aggressiveness,
      }
      if (min > 0) body.price_min = min
      if (max > 0) body.price_max = max

      const res = await fetch(`/api/admin/rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to save smart pricing settings')
      }
      onSuccess(
        room.id,
        {
          smart_pricing_enabled: enabled,
          smart_pricing_aggressiveness: aggressiveness,
          price_min: min || null,
          price_max: max || null,
        },
        enabled,
      )
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

        {/* Enable / Disable toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <p className="text-sm font-semibold text-slate-800">Enable Smart Pricing</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically adjust nightly rates based on demand signals
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-teal-400' : 'bg-slate-300'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>

        {enabled && (
          <>
            {/* Aggressiveness */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Aggressiveness</label>
              <div className="grid grid-cols-3 gap-2">
                {AGGRESSIVENESS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAggressiveness(opt.value)}
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-colors ${
                      aggressiveness === opt.value
                        ? 'border-teal-400 bg-teal-50 text-teal-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[10px] mt-0.5 leading-snug opacity-70">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Price range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Price Floor (min)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
                    min={1} step={1} required
                    className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Price Ceiling (max)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
                    min={1} step={1} required
                    className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
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

            <p className="text-xs text-slate-400 bg-teal-50 border border-teal-200 rounded-lg p-2.5">
              ⚡ Runs nightly · Prices applied for the next 120 days · Manual overrides always take priority.
            </p>
          </>
        )}

        {!enabled && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            Smart pricing is off. When disabled, all engine-generated prices are cleared and your base rate / manual overrides apply.
          </p>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: '#2DD4BF' }}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
