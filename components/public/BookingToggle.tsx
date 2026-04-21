'use client'

import { useState } from 'react'
import BookingWidget from './BookingWidget'
import type { Room, CancellationPolicy } from '@/types'

interface Props {
  room: Room
  blockedDates: string[]
  dateOverrides?: Record<string, number>
  initialCheckin?: string
  initialCheckout?: string
  initialGuests?: number
  stripeFeePercent?: number
  stripeFeeFlat?: number
  cancellationPolicy: CancellationPolicy
  hospitableWidgetSrc: string
}

export default function BookingToggle({
  room,
  blockedDates,
  dateOverrides,
  initialCheckin,
  initialCheckout,
  initialGuests,
  stripeFeePercent,
  stripeFeeFlat,
  cancellationPolicy,
  hospitableWidgetSrc,
}: Props) {
  const [mode, setMode] = useState<'direct' | 'hospitable'>('direct')

  return (
    <div className="space-y-3">
      <div className="flex rounded-xl overflow-hidden ring-1 ring-white/10">
        <button
          type="button"
          onClick={() => setMode('direct')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors duration-150 ${
            mode === 'direct'
              ? 'bg-primary text-white'
              : 'bg-surface-highest text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Book Direct
        </button>
        <button
          type="button"
          onClick={() => setMode('hospitable')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors duration-150 ${
            mode === 'hospitable'
              ? 'bg-primary text-white'
              : 'bg-surface-highest text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Book via Hospitable
        </button>
      </div>

      {mode === 'direct' ? (
        <BookingWidget
          room={room}
          blockedDates={blockedDates}
          dateOverrides={dateOverrides}
          initialCheckin={initialCheckin}
          initialCheckout={initialCheckout}
          initialGuests={initialGuests}
          stripeFeePercent={stripeFeePercent}
          stripeFeeFlat={stripeFeeFlat}
          cancellationPolicy={cancellationPolicy}
        />
      ) : (
        <iframe
          id="booking-iframe"
          sandbox="allow-top-navigation allow-scripts allow-same-origin"
          style={{ width: '100%', height: '900px' }}
          frameBorder={0}
          src={hospitableWidgetSrc}
        />
      )}
    </div>
  )
}
