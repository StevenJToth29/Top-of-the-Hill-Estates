'use client'

import { useState } from 'react'
import ManualBookingForm from './ManualBookingForm'

export default function NewManualBookingButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-secondary/20 px-4 py-2 text-sm font-semibold text-secondary hover:bg-secondary/30 transition-colors"
      >
        + New Manual Booking
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-xl p-4">
          <div className="my-8 w-full max-w-2xl bg-surface-container rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-on-surface">New Manual Booking</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-highest/40 transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ManualBookingForm onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
