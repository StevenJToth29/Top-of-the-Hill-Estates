'use client'

import { useState, useRef } from 'react'
import type { BookingApplication } from '@/types'

interface ScreeningQuestionsStepProps {
  bookingId: string
  saved: Partial<BookingApplication>
  houseRules: string
  onChange: (fields: Partial<BookingApplication>) => void
}

export default function ScreeningQuestionsStep({
  bookingId,
  saved,
  houseRules,
  onChange,
}: ScreeningQuestionsStepProps) {
  const [fields, setFields] = useState({
    purpose_of_stay: saved.purpose_of_stay ?? '',
    traveling_from: saved.traveling_from ?? '',
    shared_living_exp: saved.shared_living_exp ?? '',
    house_rules_confirmed: saved.house_rules_confirmed ?? false,
    additional_info: saved.additional_info ?? '',
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function update(patch: Partial<typeof fields>) {
    const next = { ...fields, ...patch }
    setFields(next)
    onChange(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch(`/api/bookings/${bookingId}/application`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch((err) => console.error('auto-save error:', err))
    }, 800)
  }

  const ta = 'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 resize-none min-h-[80px]'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-on-surface mb-1">Screening Questions</h2>
        <p className="text-on-surface-variant text-sm">
          Please answer each question honestly to help us ensure a great experience for all guests.
        </p>
      </div>

      <div>
        <label className="block text-on-surface text-sm font-semibold mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-white text-xs font-bold mr-2">1</span>
          What is the purpose of your stay?
        </label>
        <textarea className={ta} value={fields.purpose_of_stay} onChange={(e) => update({ purpose_of_stay: e.target.value })} placeholder="e.g. visiting family, business trip, short vacation…" />
      </div>

      <div>
        <label className="block text-on-surface text-sm font-semibold mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-white text-xs font-bold mr-2">2</span>
          Where are you traveling from?
        </label>
        <textarea className={ta} value={fields.traveling_from} onChange={(e) => update({ traveling_from: e.target.value })} placeholder="City and state, or country if international" />
      </div>

      <div>
        <label className="block text-on-surface text-sm font-semibold mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-white text-xs font-bold mr-2">3</span>
          This is a room rental inside a shared house. Do you have experience sharing common living spaces with other individuals?
        </label>
        <textarea className={ta} value={fields.shared_living_exp} onChange={(e) => update({ shared_living_exp: e.target.value })} placeholder="Please describe your experience with shared living arrangements" />
      </div>

      <div>
        <label className="block text-on-surface text-sm font-semibold mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-white text-xs font-bold mr-2">4</span>
          Please confirm you have read all the house rules.
        </label>
        {houseRules && (
          <div className="bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface-variant text-sm mb-3 max-h-32 overflow-y-auto">
            {houseRules}
          </div>
        )}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={fields.house_rules_confirmed} onChange={(e) => update({ house_rules_confirmed: e.target.checked })} className="w-5 h-5 rounded accent-secondary" />
          <span className="text-sm text-on-surface font-medium">I have read and agree to all house rules</span>
        </label>
      </div>

      <div>
        <label className="block text-on-surface text-sm font-semibold mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-white text-xs font-bold mr-2">5</span>
          Additional Information <span className="font-normal text-on-surface-variant">(optional)</span>
        </label>
        <textarea className={ta} value={fields.additional_info ?? ''} onChange={(e) => update({ additional_info: e.target.value })} placeholder="Anything else you'd like us to know about your stay…" />
      </div>
    </div>
  )
}
